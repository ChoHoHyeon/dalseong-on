/* 달성On — 출장비(관내여비) 계산하기 · 원작: 김광한(팀서무 자동화) · 달성On 통합 시 #trip 범위로 조정 */
(function(){

"use strict";
const $ = id => document.getElementById(id);
const won = n => n.toLocaleString("ko-KR");
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

// ---------- 설정 (이 브라우저에 저장) ----------
const store = {
  get(key, def) { try { const v = localStorage.getItem("travel." + key); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(key, val) { try { localStorage.setItem("travel." + key, JSON.stringify(val)); return true; } catch { return false; } },
};

// ---------- 금액 규칙 ----------
// 4시간 이상 20,000 / 미만 10,000, 공용차량 사용 시 4시간 이상 10,000 / 미만 0
function amount(over4h, car) { return car ? (over4h ? 10000 : 0) : (over4h ? 20000 : 10000); }

// ---------- 직급 순서 ----------
const LEVELS = {"관리관": 1, "이사관": 2, "부이사관": 3, "서기관": 4, "사무관": 5, "주사": 6, "주사보": 7, "서기": 8, "서기보": 9};
function rankKey(rank) {
  // "주사보"가 "주사"보다, "서기보"가 "서기"보다 먼저 검사되도록 긴 것부터 비교
  for (const s of Object.keys(LEVELS).sort((a, b) => b.length - a.length)) if (rank.endsWith(s)) return LEVELS[s];
  return 99;
}
const displayRank = r => r.startsWith("지방") && r.length > 2 ? "지방\n" + r.slice(2) : r;

// ---------- 출장내역서 PDF 읽기 ----------
const HEADER = ["성명", "직급", "구분", "공무용차량", "출장목적", "출장시작일시", "출장종료일시", "총출장시간", "여비등급", "출장지", "결재상태"];

// 같은 줄에서 가까이 붙은 글자 조각을 한 줄로 합친다
function toLines(items) {
  const parts = items.filter(it => it.str && it.str.trim()).map(it => ({
    str: it.str, x: it.transform[4], y: it.transform[5], w: it.width,
  })).sort((a, b) => b.y - a.y);
  // 높이가 거의 같은(2pt 이내) 조각끼리 묶은 뒤, 왼쪽→오른쪽 순서로 바로 붙어 있는 조각만 합친다
  // (칸마다 글자 높이가 1pt쯤 달라도 같은 묶음 안에서 x 순서로 정렬되어 다른 칸 글자와 섞이지 않음)
  const bands = [];
  for (const p of parts) {
    const band = bands[bands.length - 1];
    if (band && band[0].y - p.y < 2) band.push(p); else bands.push([p]);
  }
  const lines = [];
  for (const band of bands) {
    let line = null;
    for (const p of band.sort((a, b) => a.x - b.x)) {
      const gap = line ? p.x - line.x2 : Infinity;
      if (line && gap > -1 && gap < 6) {
        line.str += (gap > 1 && !line.str.endsWith(" ") ? " " : "") + p.str;
        line.x2 = p.x + p.w;
      } else {
        line = {str: p.str, x1: p.x, x2: p.x + p.w, y: p.y};
        lines.push(line);
      }
    }
  }
  // 이 PDF의 숫자 글꼴은 글자 폭이 좁아 pdf.js가 숫자 뒤에 가짜 공백을 넣는다 ("2 0 2 6 -1 0 -1 4")
  return lines.map(l => ({str: l.str.replace(/(\d) (?=\S)/g, "$1").trim(), cx: (l.x1 + l.x2) / 2, y: l.y}));
}

function parsePage(lines) {
  // 머리글 줄 찾기
  const head = {};
  for (const h of HEADER) {
    const l = lines.find(l => l.str === h);
    if (!l) return [];
    head[h] = l;
  }
  const headY = Math.min(...Object.values(head).map(l => l.y));
  const cols = HEADER.map(h => ({h, cx: head[h].cx}));
  const colOf = l => cols.reduce((a, b) => Math.abs(b.cx - l.cx) < Math.abs(a.cx - l.cx) ? b : a).h;
  const body = lines.filter(l => l.y < headY - 2).map(l => ({...l, col: colOf(l)}));

  // 출장시작일시 칸의 날짜·시간으로 각 행의 세로 중심을 정한다 (칸 내용은 세로 가운데 정렬)
  const starts = body.filter(l => l.col === "출장시작일시");
  const centers = [];
  for (const d of starts.filter(l => /^\d{4}-\d{2}-\d{2}/.test(l.str))) {
    if (/\d{1,2}:\d{2}$/.test(d.str)) { centers.push(d.y); continue; }
    const t = starts.filter(l => /^\d{1,2}:\d{2}$/.test(l.str) && l.y < d.y && d.y - l.y < 20)
      .sort((a, b) => b.y - a.y)[0];
    centers.push(t ? (d.y + t.y) / 2 : d.y);
  }
  if (!centers.length) return [];
  centers.sort((a, b) => b - a);
  let half = 30;
  for (let i = 1; i < centers.length; i++) half = Math.min(half, (centers[i - 1] - centers[i]) / 2 + 1);

  const rows = centers.map(() => Object.fromEntries(HEADER.map(h => [h, []])));
  for (const l of body) {
    let best = -1, dist = Infinity;
    centers.forEach((c, i) => { const d = Math.abs(c - l.y); if (d < dist) { dist = d; best = i; } });
    if (dist <= half) rows[best][l.col].push(l);
  }
  // 칸 안 여러 줄은 위→아래로 이어 붙인다 (PDF 칸 폭 때문에 생긴 줄바꿈)
  return rows.map(r => Object.fromEntries(HEADER.map(h => [h, r[h].sort((a, b) => b.y - a.y).map(l => l.str).join("")])));
}

// ---------- 출장내역서 두 번째 서식 (순번·구분·출발일자·도착일자·총출장시간·출장지·차량·출장목적·소속·출장자…) ----------
// 칸 사이가 좁아 조각을 줄로 합치면 옆 칸 글자와 섞이므로, pdf.js 조각 하나하나를 머리글 x 위치로 칸에 넣는다.
const HEADER2 = ["순번", "구분", "출발일자", "도착일자", "총출장시간", "출장지", "차량", "출장목적", "소속", "출장자", "지출", "여비", "지출일자", "결재상태", "여비등급", "비고", "업무대행"];
function parsePage2(items) {
  const fix = s => s.replace(/(\d) (?=\S)/g, "$1").trim();
  const parts = items.filter(it => it.str && it.str.trim()).map(it => ({str: it.str, x: it.transform[4], y: it.transform[5], w: it.width}));
  const head = {};
  for (const p of parts) {
    const words = p.str.trim().split(/\s+/);
    if (!words.every(w => HEADER2.includes(w))) continue;
    // "결재상태 여비등급"처럼 붙어 나온 머리글은 글자 수 비율로 나눠 위치를 잡는다
    const total = p.str.trim().length; let pos = 0;
    for (const w of words) { const i = p.str.indexOf(w, pos); head[w] = {cx: p.x + p.w * (i + w.length / 2) / total, y: p.y}; pos = i + w.length; }
  }
  if (!["출장자", "출발일자", "도착일자", "구분"].every(h => head[h])) return [];
  const headY = Math.min(...Object.values(head).map(h => h.y));
  const cols = Object.entries(head).map(([h, v]) => ({h, cx: v.cx}));
  const colOf = cx => cols.reduce((a, b) => Math.abs(b.cx - cx) < Math.abs(a.cx - cx) ? b : a).h;
  const body = parts.filter(p => p.y < headY - 2 && p.y > 60).map(p => ({str: fix(p.str), y: p.y, col: colOf(p.x + p.w / 2)}));
  const dates = body.filter(l => l.col === "출발일자" && /^\d{4}-\d{2}-\d{2}$/.test(l.str));
  const centers = dates.map(d => { const t = body.find(l => l.col === "출발일자" && /^\d{1,2}:\d{2}$/.test(l.str) && l.y < d.y && d.y - l.y < 20); return t ? (d.y + t.y) / 2 : d.y; }).sort((a, b) => b - a);
  if (!centers.length) return [];
  let half = 30; for (let i = 1; i < centers.length; i++) half = Math.min(half, (centers[i - 1] - centers[i]) / 2 + 1);
  const rows = centers.map(() => ({}));
  for (const l of body) {
    let best = -1, dist = Infinity;
    centers.forEach((c, i) => { const d = Math.abs(c - l.y); if (d < dist) { dist = d; best = i; } });
    if (dist <= half) (rows[best][l.col] = rows[best][l.col] || []).push(l);
  }
  const cell = (r, h, sep = "") => (r[h] || []).sort((a, b) => b.y - a.y).map(l => l.str).join(sep);
  return rows.map(r => ({
    "성명": cell(r, "출장자"), "직급": cell(r, "여비등급"), "구분": cell(r, "구분"), "공무용차량": cell(r, "차량"),
    "출장목적": cell(r, "출장목적"), "출장시작일시": cell(r, "출발일자", " "), "출장종료일시": cell(r, "도착일자", " "),
    "총출장시간": cell(r, "총출장시간"), "여비등급": cell(r, "여비등급"), "출장지": cell(r, "출장지"), "결재상태": cell(r, "결재상태"),
  }));
}

const hm = m => `${Math.floor(m / 60)}시간${m % 60}분`;
const clock = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const WORK_START = 9 * 60, WORK_END = 18 * 60;  // 여러 날 출장을 날짜별로 나눌 때 쓰는 하루 근무시간

// 출장 한 건 → 날짜별 출장 건 목록 (하루짜리면 1건)
// 여러 날이면: 총출장시간이 날짜 수만큼 적혀 있으면 그 값을, 아니면 첫날 출발~18:00, 중간 날 09:00~18:00, 마지막 날 09:00~도착으로 날마다 계산
function toTrips(r) {
  const nm = r["성명"].match(/^\s*([^(\s]+)\s*(?:\((\w+)\))?/);
  const st = r["출장시작일시"].match(/(\d{4}-\d{2}-\d{2})\s*(\d{1,2}):(\d{2})/);
  const en = r["출장종료일시"].match(/(\d{4}-\d{2}-\d{2})\s*(\d{1,2}):(\d{2})/);
  if (!nm || !st || !en) return [];
  const startMin = +st[2] * 60 + +st[3], endMin = +en[2] * 60 + +en[3];
  const days = [];
  for (let d = new Date(st[1] + "T00:00"); d <= new Date(en[1] + "T00:00"); d.setDate(d.getDate() + 1))
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  const durs = [...r["총출장시간"].replace(/\s/g, "").matchAll(/(\d+)시간(?:(\d+)분)?|(\d+)분/g)]
    .map(m => m[3] !== undefined ? +m[3] : +m[1] * 60 + (+m[2] || 0));
  const car = r["공무용차량"] === "사용", status = r["결재상태"];
  return days.map((date, i) => {
    const last = i === days.length - 1;
    const from = i === 0 ? startMin : WORK_START, to = last ? endMin : WORK_END;
    let minutes;
    if (days.length === 1) minutes = durs.length ? durs[0] : Math.max(0, endMin - startMin);
    else if (durs.length === days.length) minutes = durs[i];
    else minutes = Math.max(0, to - from);
    const over4h = minutes >= 240;
    return {
      name: nm[1], empNo: nm[2] || "", rank: r["직급"], date, kind: r["구분"],
      start: `${date} ${clock(from)}`, end: `${date} ${clock(Math.max(from, to))}`,
      minutes, duration: hm(minutes) + (days.length > 1 ? ` (${i + 1}/${days.length}일차)` : ""),
      place: r["출장지"], purpose: r["출장목적"], car, status, over4h, amount: amount(over4h, car),
      approved: status === "결재완료", include: status === "결재완료",
    };
  });
}

async function readPdf(file) {
  const pdf = await pdfjsLib.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
  const trips = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    let rows = parsePage(toLines(tc.items));
    if (!rows.length) rows = parsePage2(tc.items);   // 두 번째 서식
    for (const r of rows) trips.push(...toTrips(r));
  }
  return trips;
}

// ---------- 화면 상태 ----------
let trips = [], order = [], monthKeys = [], selected = null;

const drop = $("drop");
drop.onclick = () => $("file").click();
$("file").onchange = e => { load(e.target.files); e.target.value = ""; };
// 샘플 출장내역서: 내려받지 않고 바로 올린 상태로 → 판정까지 자동 진행 (이름·사번은 가명)
{ const sb = $("tripSample"); if (sb) sb.onclick = async e => { e.stopPropagation(); sb.disabled = true; const t = sb.textContent; sb.textContent = "샘플 불러오는 중…";
    try { const b = await (await fetch("assets/demo_trip.pdf")).blob(); await load([new File([b], "샘플_출장내역서(2026년10월).pdf", {type: "application/pdf"})]); }
    catch (err) { window.toast && toast("샘플을 불러오지 못했습니다: " + err.message); }
    finally { sb.disabled = false; sb.textContent = t; } }; }
drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
drop.ondragleave = () => drop.classList.remove("over");
drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); load(e.dataTransfer.files); };

async function load(files) {
  files = [...files];
  if (!files.length) return;
  $("readMsg").innerHTML = '<div class="msg">읽는 중…</div>';
  const found = [], errors = [], seen = new Set();
  let outside = 0;
  for (const f of files) {
    try {
      const ts = await readPdf(f);
      if (!ts.length) errors.push(`${f.name}: 출장 내역을 찾지 못했습니다.`);
      for (const t of ts) {
        // 관내여비는 근무지내(관내) 출장만 — 근무지외(관외) 출장은 뺀다
        if (t.kind && !t.kind.includes("근무지내")) { outside++; continue; }
        const key = [t.name, t.empNo, t.date, t.start, t.end].join("|");
        if (!seen.has(key)) { seen.add(key); found.push(t); }  // 같은 파일을 두 번 고른 경우
      }
    } catch (e) {
      errors.push(`${f.name}: 읽을 수 없습니다. (${e.message || e})`);
    }
  }
  trips = found.sort((a, b) => rankKey(a.rank) - rankKey(b.rank) || a.name.localeCompare(b.name) || a.start.localeCompare(b.start));
  const names = [...new Set(trips.map(t => t.name))];
  const saved = store.get("order", []);
  order = [...saved.filter(n => names.includes(n)), ...names.filter(n => !saved.includes(n))];
  selected = null;

  let html = errors.map(e => `<div class="msg err">${esc(e)}</div>`).join("");
  html += `<div class="msg ok">${files.length}개 파일, ${names.length}명, ${trips.length}건 읽음</div>`;
  if (outside) html += `<div class="msg warn">근무지외(관외) 출장 ${outside}건은 관내여비 대상이 아니라서 뺐습니다.</div>`;
  const multi = trips.filter(t => / 1\/\d+일차/.test(t.duration)).length;
  if (multi) html += `<div class="msg warn">이틀 이상 이어진 출장 ${multi}건은 날짜별로 나눴습니다. 출장시간 칸에 몇 일차인지 표시되어 있으니 확인하세요.</div>`;
  $("readMsg").innerHTML = html;

  const counts = {};
  trips.filter(t => t.approved).forEach(t => { const k = t.date.slice(0, 7); counts[k] = (counts[k] || 0) + 1; });
  monthKeys = Object.keys(counts).sort();
  if (!monthKeys.length) { showSteps(false); return; }
  // 건수가 가장 많은 달 (같으면 최근 달)
  const best = monthKeys.reduce((a, b) => counts[b] >= counts[a] ? b : a);
  $("month").innerHTML = monthKeys.map(k =>
    `<option value="${k}" ${k === best ? "selected" : ""}>${k.slice(0, 4)}년 ${+k.slice(5)}월 (${counts[k]}건)</option>`).join("");
  showSteps(true);
  render();
}
function showSteps(on) { for (const id of ["step2", "step4", "step5"]) $(id).hidden = !on; }

$("month").onchange = () => { selected = null; render(); };
const monthTrips = () => trips.filter(t => t.date.startsWith($("month").value));
const monthPeople = () => { const s = new Set(monthTrips().map(t => t.name)); return order.filter(n => s.has(n)); };

function render() {
  const list = monthTrips();
  let html = "", total = 0;
  for (const name of monthPeople()) {
    const sub = {n: 0, over: 0, under: 0, car: 0, amt: 0};
    const sel = name === selected ? " sel" : "";
    for (const t of list.filter(t => t.name === name)) {
      const i = trips.indexOf(t);
      if (t.include) { sub.n++; sub.over += t.over4h; sub.under += !t.over4h; sub.car += t.car; sub.amt += t.amount; }
      html += `<tr class="${t.include ? "" : "off"}${sel}" data-name="${esc(name)}">
        <td><input type="checkbox" data-i="${i}" data-f="include" ${t.include ? "checked" : ""}></td>
        <td>${esc(t.rank)}</td><td>${esc(t.name)}</td><td>${+t.date.slice(5, 7)}. ${+t.date.slice(8)}.</td>
        <td title="${esc(t.start)} ~ ${esc(t.end.slice(11))}">${esc(t.duration)}${t.approved ? "" : `<br><small>(${esc(t.status)})</small>`}</td>
        <td><textarea class="cell" rows="1" data-i="${i}" data-f="place">${esc(t.place)}</textarea></td>
        <td><textarea class="cell" rows="1" data-i="${i}" data-f="purpose">${esc(t.purpose)}</textarea></td>
        <td>${+t.over4h}</td><td>${+!t.over4h}</td><td>${t.car ? "사용" : "-"}</td><td class="num">${won(t.amount)}</td></tr>`;
    }
    total += sub.amt;
    html += `<tr class="sub${sel}" data-name="${esc(name)}"><td></td><td>소계</td><td></td><td>${sub.n}일</td><td></td><td></td><td></td>
      <td>${sub.over}</td><td>${sub.under}</td><td>${sub.car}</td><td class="num">${won(sub.amt)}</td></tr>`;
  }
  html += `<tr class="total"><td></td><td>합계</td><td colspan="8"></td><td class="num">${won(total)}</td></tr>`;
  $("rows").innerHTML = html;
  $("rows").querySelectorAll("textarea.cell").forEach(autoSize);

  const warns = [];
  if (monthKeys.length > 1)
    warns.push(`PDF에 여러 달(${monthKeys.map(k => +k.slice(5) + "월").join(", ")})이 섞여 있습니다. 작성 월을 확인하세요.`);
  const off = list.filter(t => !t.approved).length;
  if (off) warns.push(`결재완료가 아닌 ${off}건은 기본으로 제외했습니다.`);
  const days = {};
  list.filter(t => t.include).forEach(t => { const k = `${t.name} ${t.date}`; days[k] = (days[k] || 0) + 1; });
  for (const [k, n] of Object.entries(days))
    if (n > 1) warns.push(`${k} 에 출장이 ${n}건 있습니다. 하루 1건만 지급하면 하나를 빼주세요.`);
  $("warnings").innerHTML = warns.map(w => `<div class="msg warn">${esc(w)}</div>`).join("");
  renderJo();
}

function autoSize(ta) {
  if (!ta.offsetParent) return;  // 화면에 안 보일 때는 높이를 잴 수 없음
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + 2 + "px";
}
// 창 크기가 바뀌면 칸 폭이 달라지므로 높이를 다시 맞춘다
window.addEventListener("resize", () => $("rows").querySelectorAll("textarea.cell").forEach(autoSize));

$("rows").addEventListener("input", e => {
  const el = e.target, t = trips[el.dataset.i];
  if (!t) return;
  if (el.dataset.f === "include") { t.include = el.checked; render(); return; }
  if (el.tagName === "TEXTAREA") {
    el.value = el.value.replace(/\s*\n\s*/g, " ");  // 명세서 칸은 한 줄 글이므로 줄바꿈은 넣지 않는다
    autoSize(el);
  }
  t[el.dataset.f] = el.value;
});
$("rows").addEventListener("keydown", e => { if (e.target.tagName === "TEXTAREA" && e.key === "Enter") e.preventDefault(); });
$("rows").addEventListener("click", e => {
  if (e.target.closest("input")) return;
  const tr = e.target.closest("tr[data-name]");
  if (!tr) return;
  selected = tr.dataset.name;
  render();
});

function move(step) {
  if (!selected) { alert("옮길 사람의 행을 먼저 클릭하세요."); return; }
  const people = monthPeople();
  const i = people.indexOf(selected), j = i + step;
  if (i < 0 || j < 0 || j >= people.length) return;
  // 이번 달 사람들끼리 자리를 바꾸고, 전체 순서에 다시 반영
  [people[i], people[j]] = [people[j], people[i]];
  let k = 0;
  order = order.map(n => people.includes(n) ? people[k++] : n);
  const saved = store.get("order", []);
  store.set("order", [...order, ...saved.filter(n => !order.includes(n))]);
  render();
}
$("up").onclick = () => move(-1);
$("down").onclick = () => move(1);

// ---------- 공통 정보 · 대조일자 · 확인자 ----------
const today = new Date();
$("checkDate").value = `${today.getFullYear()}. ${today.getMonth() + 1}.`;
$("checker").value = store.get("checker", "");
$("team").value = store.get("team", "");
$("dept").value = store.get("dept", "");
$("phone").value = store.get("phone", "");
function saveField(key, label, input) {
  const v = input.value.trim();
  if (store.set(key, v)) alert(`${label}을(를) 저장했습니다. 다음에 열 때도 입력되어 있습니다.\n\n${v || "(비어 있음)"}`);
  else alert("이 브라우저에서는 저장할 수 없습니다. (개인정보 보호 모드 등)");
}
$("saveChecker").onclick = () => saveField("checker", "확인자", $("checker"));
$("saveTeam").onclick = () => saveField("team", "팀 이름", $("team"));
$("saveDept").onclick = () => saveField("dept", "부서명", $("dept"));
$("savePhone").onclick = () => saveField("phone", "전화번호", $("phone"));

// ---------- 이번 달 데이터 (명세서·조서 공통) ----------
function monthData() {
  const included = monthTrips().filter(t => t.include);
  if (!included.length) throw new Error("포함된 출장 건이 없습니다.");
  const [y, m] = $("month").value.split("-").map(Number);
  const team = $("team").value.trim();
  const people = monthPeople().map(name => {
    const ts = included.filter(t => t.name === name).sort((a, b) => a.start.localeCompare(b.start));
    return ts.length ? {name, rank: ts[0].rank, trips: ts, amount: ts.reduce((s, t) => s + t.amount, 0)} : null;
  }).filter(Boolean);
  return {
    y, m, team, people,
    teamSuffix: team ? `(${team})` : "",
    fileTeam: team.replace(/[\\/:*?"<>|]/g, ""),  // 파일명에 못 쓰는 문자 제거
    total: included.reduce((s, t) => s + t.amount, 0),
  };
}

function sheetData() {
  const d = monthData();
  const checkDate = $("checkDate").value.trim(), checker = $("checker").value.trim();
  if (!checkDate || !checker) throw new Error("출장명령 대조일자와 확인자를 입력하세요.");
  return {
    ...d, checkDate, checker,
    title: `${d.m}월 관내여비 지급명세서` + (d.team ? ` (${d.team})` : ""),
    fileName: `${d.y}년 관내여비 지급명세서` + (d.fileTeam ? `(${d.fileTeam})` : "") + `_${d.m}월`,
  };
}

// ---------- 지급조서: 은행·계좌번호 ----------
// 은행·계좌번호는 사람(성명)별로 이 브라우저에 저장, 직급·비고는 이번 화면에서만 고칠 수 있음
let accounts = store.get("accounts", {});
const joEdits = {};

// '지방전산주사' → '전산6급' (조서 표기)
function gradeRank(rank) {
  const base = rank.replace(/^지방/, "");
  for (const s of Object.keys(LEVELS).sort((a, b) => b.length - a.length))
    if (base.endsWith(s)) return `${base.slice(0, -s.length)}${LEVELS[s]}급`;
  return rank;
}

function joPeople() {
  let d;
  try { d = monthData(); } catch { return []; }
  return d.people.filter(p => p.amount > 0).map(p => {
    const acc = accounts[p.name] || {}, ed = joEdits[p.name] || {};
    return {...p, grade: ed.grade ?? gradeRank(p.rank), bank: acc.bank || "", account: acc.account || "", note: ed.note || ""};
  });
}

function renderJo() {
  const rows = joPeople();
  $("joRows").innerHTML = rows.length ? rows.map((p, i) => `<tr data-name="${esc(p.name)}">
      <td>${i + 1}</td>
      <td><input type="text" data-f="grade" value="${esc(p.grade)}"></td>
      <td>${esc(p.name)}</td><td class="num">${won(p.amount)}</td>
      <td><input type="text" data-f="bank" value="${esc(p.bank)}" placeholder="예) 농협"></td>
      <td><input type="text" data-f="account" value="${esc(p.account)}" placeholder="예) 123-4567-8901-23"></td>
      <td><input type="text" data-f="note" value="${esc(p.note)}"></td></tr>`).join("")
    : `<tr><td colspan="7" class="hint">지급할 금액이 있는 사람이 없습니다.</td></tr>`;
}

$("joRows").addEventListener("input", e => {
  const el = e.target, name = el.closest("tr")?.dataset.name, f = el.dataset.f;
  if (!name || !f) return;
  if (f === "bank" || f === "account") {
    accounts[name] = {...(accounts[name] || {}), [f]: el.value.trim()};
    store.set("accounts", accounts);
  } else {
    joEdits[name] = {...(joEdits[name] || {}), [f]: el.value};
  }
});

function joData() {
  const d = monthData();
  const rows = joPeople();
  if (!rows.length) throw new Error("지급할 금액이 있는 사람이 없습니다.");
  const missing = rows.filter(p => !p.bank || !p.account).map(p => p.name);
  return {
    ...d, rows, missing,
    dept: $("dept").value.trim(), phone: $("phone").value.trim(),
    title: `${d.m}월 관내여비 지급조서${d.teamSuffix}`,
    fileName: `${d.y}년 관내여비 지급조서` + (d.fileTeam ? `(${d.fileTeam})` : "") + `_${d.m}월`,
  };
}
const md = t => `${+t.date.slice(5, 7)}. ${+t.date.slice(8)}.`;

// ---------- 엑셀 (기존 양식과 같은 서식) ----------
const FONT = {name: "맑은 고딕", size: 14, color: {argb: "FF000000"}};
const FILL = argb => ({type: "pattern", pattern: "solid", fgColor: {argb}});
const YELLOW = FILL("FFFFFFCC"), CYAN = FILL("FFCCFFFF");
const NF_CNT = "0_);[Red]\\(0\\)", NF_WON = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"_);_(@_)';
const NF_SUB = "#,##0_);[Red]\\(#,##0\\)";
const box = (l = "hair", r = "hair", t = "hair", b = "hair") =>
  Object.fromEntries([["left", l], ["right", r], ["top", t], ["bottom", b]].filter(([, s]) => s).map(([k, s]) => [k, {style: s}]));
const COLS = "ABCDEFGHIJKL".split("");
const WIDTHS = [6.71, 15, 9.57, 16.57, 25.43, 54.14, 5.86, 10.29, 13, 12.57, 13.14, 10];

// 출장지·출장목적 칸에 글을 어떻게 넣을지 정한다 (builder.py text_fit 과 같은 규칙)
// 칸 폭과 14pt 글자 폭 추정치를 비교해: 들어가면 그대로, 조금 길면 '셀에 맞춤'(9pt 이상 유지),
// 그보다 길면 12pt로 띄어쓰기 단위 줄바꿈하고, 줄 수만큼 행을 높인다
const WRAP_FONT = 12, WRAP_LINE = 16.5;
const units = text => [...text].reduce((s, ch) => s + (ch.codePointAt(0) > 0x2000 ? 2.3 : 1.2), 0);
function textFit(text, colWidth) {
  text = String(text || "");
  const room = Math.max(colWidth - 1, 1);
  const ratio = units(text) / room;
  if (ratio <= 1) return ["fit", text];
  if (ratio <= 1.5) return ["shrink", text];
  const cap = room * 14 / WRAP_FONT * 0.92;  // 12pt 글자는 14pt보다 좁다, 여유 8%
  const lines = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const cand = cur ? `${cur} ${word}` : word;
    if (cur && units(cand) > cap) { lines.push(cur); cur = word; } else cur = cand;
  }
  lines.push(cur);
  return ["wrap", lines.join("\n")];
}

function put(ws, addr, value, style = {}) {
  const c = ws.getCell(addr);
  if (value !== undefined) c.value = value;
  c.font = {...FONT, ...(style.font || {})};
  c.alignment = {vertical: "middle", ...(style.align || {})};
  if (style.border) c.border = style.border;
  if (style.fill) c.fill = style.fill;
  if (style.numFmt) c.numFmt = style.numFmt;
}

async function buildXlsx(d) {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet(`${d.y}. ${d.m}`, {
    pageSetup: {paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: {left: 0.39, right: 0.39, top: 0.83, bottom: 0.39, header: 0, footer: 0}},
  });
  ws.columns = WIDTHS.map(w => ({width: w}));

  // 제목·머리글
  ws.mergeCells("A1:L1");
  put(ws, "A1", d.title, {font: {name: "HY헤드라인M", size: 24}, align: {horizontal: "center"}});
  ws.getRow(1).height = 45;
  put(ws, "A2", "1. 청구 및 영수내역");
  put(ws, "L2", "(단위: 원)", {align: {horizontal: "right"}});
  ws.getRow(2).height = 18.75;
  const headAlign = {horizontal: "center", wrapText: true};
  for (const c of COLS) for (const r of [3, 4]) {
    put(ws, c + r, undefined, {fill: YELLOW, align: headAlign,
      border: box(c === "A" ? "medium" : "hair", c === "L" ? "medium" : "hair", r === 3 ? "medium" : "hair", "hair")});
  }
  for (const rng of ["A3:C3", "G3:J3", "D3:D4", "E3:E4", "F3:F4", "K3:K4", "L3:L4"]) ws.mergeCells(rng);
  const heads = {A3: "출장자", G3: "출장일수", D3: "출장\n일자", E3: "출장지", F3: "출장목적", K3: "청구 및\n영수금액",
    L3: "청구 및\n영수인", A4: "소속", B4: "직급", C4: "성명", G4: "계", H4: "4시간\n이상", I4: "4시간\n미만", J4: "공용차량\n사용"};
  for (const [a, v] of Object.entries(heads)) ws.getCell(a).value = v;
  ws.getRow(3).height = 26.25;
  ws.getRow(4).height = 57;

  // 사람별 행 + 소계
  let row = 5;
  const subRows = [];
  for (const p of d.people) {
    const first = row;
    for (const t of p.trips) {
      const over = t.over4h ? 1 : 0, car = t.car ? 1 : 0;
      put(ws, "D" + row, md(t), {border: box(), align: {horizontal: "center"}, numFmt: "@"});
      let height = 40.5;
      for (const [c, text] of [["E", t.place], ["F", t.purpose]]) {
        const [mode, value] = textFit(text, WIDTHS[COLS.indexOf(c)]);
        const style = {border: box(), align: {horizontal: "center"}, numFmt: "@"};
        if (mode === "shrink") style.align.shrinkToFit = true;
        if (mode === "wrap") {
          style.align.wrapText = true;
          style.font = {size: WRAP_FONT};
          height = Math.max(height, value.split("\n").length * WRAP_LINE + 8);
        }
        put(ws, c + row, value, style);
      }
      put(ws, "G" + row, {formula: `SUM(H${row}:I${row})`, result: 1}, {border: box(), align: {horizontal: "right"}, numFmt: NF_CNT});
      put(ws, "H" + row, over, {border: box(), align: {horizontal: "right"}, numFmt: NF_CNT});
      put(ws, "I" + row, 1 - over, {border: box(), align: {horizontal: "right"}, numFmt: NF_CNT});
      put(ws, "J" + row, car, {border: box(), align: {horizontal: "right"}, numFmt: NF_CNT});
      put(ws, "K" + row, {formula: `IF(J${row}=0,IF(H${row}=1,20000,10000),IF(H${row}=1,10000,0))`, result: t.amount},
        {border: box(), numFmt: NF_WON});
      ws.getRow(row).height = height;
      row++;
    }
    const last = row - 1;
    if (last > first) for (const c of "BCL") ws.mergeCells(`${c}${first}:${c}${last}`);
    // 병합된 칸은 ExcelJS에서 첫 칸 서식을 함께 쓰므로 첫 칸만 꾸민다
    put(ws, "B" + first, displayRank(p.rank), {border: box(), align: {horizontal: "center", wrapText: true}});
    put(ws, "C" + first, p.name, {border: box(), align: {horizontal: "center", wrapText: true}});
    put(ws, "L" + first, undefined, {border: box("hair", "medium"), align: {horizontal: "center"}});

    const sum = {G: 0, H: 0, I: 0, J: 0, K: 0};
    for (const t of p.trips) { sum.G++; sum.H += t.over4h; sum.I += !t.over4h; sum.J += t.car; sum.K += t.amount; }
    for (const c of COLS.slice(1)) put(ws, c + row, undefined, {fill: CYAN, border: box("hair", c === "L" ? "medium" : "hair")});
    put(ws, "B" + row, "소계", {fill: CYAN, border: box(), align: {horizontal: "center"}});
    put(ws, "D" + row, {formula: `COUNTA(D${first}:D${last})`, result: p.trips.length},
      {fill: CYAN, border: box(), align: {horizontal: "center"}, font: {bold: true}, numFmt: 'd"일"'});
    for (const c of "GHIJ") put(ws, c + row, {formula: `SUM(${c}${first}:${c}${last})`, result: sum[c]},
      {fill: CYAN, border: box(), align: {horizontal: "right"}, numFmt: NF_CNT});
    put(ws, "K" + row, {formula: `SUM(K${first}:K${last})`, result: sum.K}, {fill: CYAN, border: box(), numFmt: NF_SUB});
    ws.getRow(row).height = 30.75;
    subRows.push(row);
    row++;
  }

  // 합계
  for (const c of COLS.slice(1)) put(ws, c + row, undefined, {border: box(null, c === "L" ? "medium" : null, "hair", "medium")});
  put(ws, "B" + row, "합계", {border: box("hair", null, "hair", "medium"), align: {horizontal: "center"}});
  put(ws, "K" + row, {formula: `SUM(${subRows.map(r => "K" + r).join(",")})`, result: d.total},
    {border: box(null, null, "hair", "medium"), numFmt: NF_WON});
  ws.getRow(row).height = 30.75;
  ws.mergeCells(`A5:A${row}`);
  put(ws, "A5", undefined, {border: box("medium", "hair", null, "medium")});

  ws.getRow(row + 1).height = 18.75;
  put(ws, "A" + (row + 2), `2. 출장명령 대조일자 : ${d.checkDate}`);
  put(ws, "B" + (row + 3), `확인자  :  ${d.checker}    (인)`);
  ws.getRow(row + 2).height = 23.25;
  ws.getRow(row + 3).height = 23.25;
  ws.pageSetup.printArea = `A1:L${row + 3}`;

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// ---------- 지급조서 엑셀 (관내여비 조서.xlsx 양식과 같은 서식) ----------
const JO_WIDTHS = [5.33, 13, 7.89, 6.89, 11.44, 7.55, 20.66, 5.33];
const JO_COLS = "ABCDEFGH".split("");
const MYEONGJO = "조선일보명조";
const NF_JO = '_-* #,##0_-;\\-* #,##0_-;_-* "-"_-;_-@_-';

async function buildJoXlsx(d) {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet(`${d.y}. ${d.m}`, {
    pageSetup: {paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: {left: 0.71, right: 0.71, top: 0.98, bottom: 0.79, header: 0.51, footer: 0.51}},
  });
  ws.columns = JO_WIDTHS.map(w => ({width: w}));
  const last = 6 + d.rows.length;
  for (let r = 1; r <= last; r++) ws.getRow(r).height = 50.1;
  // 바깥 굵은 테두리(양옆) + 맨 윗줄
  const side = (c, r, b = {}) => ({...b, ...(c === "A" ? {left: {style: "medium"}} : {}), ...(c === "H" ? {right: {style: "medium"}} : {}),
    ...(r === 1 ? {top: {style: "medium"}} : {})});
  // family 1(명조 계열)·charset 129(한글): 조선일보명조가 없는 PC에서도 엑셀이 명조체로 대신 보여준다 (원본 양식과 같음)
  const my = (size, bold) => ({name: MYEONGJO, family: 1, charset: 129, size, bold: !!bold});

  for (const r of [1, 2, 3, 4]) for (const c of JO_COLS)
    put(ws, c + r, undefined, {font: r === 1 ? {name: "돋움", size: 11} : my(11), border: side(c, r)});
  ws.mergeCells("A2:H2");
  put(ws, "A2", d.title, {font: my(22.8), align: {horizontal: "center"}, border: side("A", 2, {right: {style: "medium"}})});
  put(ws, "A4", `부서명 : ${d.dept}` + (d.team ? ` (${d.team})` : ""), {font: my(12.35), border: side("A", 4)});
  put(ws, "E4", `전화 : ${d.phone}`, {font: my(11)});

  const hair = {left: {style: "hair"}, right: {style: "hair"}, top: {style: "hair"}, bottom: {style: "hair"}};
  const heads = ["연번", "적    요", "직  급", "성  명", "금    액", "은행", "계좌번호", "비고"];
  JO_COLS.forEach((c, i) => put(ws, c + 5, heads[i], {font: my(13), fill: FILL("FFCCFFCC"),
    align: {horizontal: "center", wrapText: true}, border: side(c, 5, {...hair, top: {style: "medium"}})}));

  const cell = (c, r, value, o = {}) => put(ws, c + r, value, {font: my(o.size || 12, o.bold), border: side(c, r, hair),
    align: {...(o.right ? {} : {horizontal: "center"}), ...(o.shrink ? {shrinkToFit: true} : {})}, numFmt: o.numFmt});
  JO_COLS.forEach(c => cell(c, 6, undefined, {bold: true, size: c === "A" ? 13 : 12}));
  cell("B", 6, "합      계", {bold: true});
  cell("E", 6, {formula: `SUM(E7:E${last})`, result: d.total}, {bold: true, right: true, numFmt: NF_JO});

  d.rows.forEach((p, i) => {
    const r = 7 + i;
    cell("A", r, i + 1, {size: 13});
    cell("B", r, "관내 출장여비", {shrink: true});
    cell("C", r, p.grade, {shrink: true});
    cell("D", r, p.name, {shrink: true});
    cell("E", r, p.amount, {right: true, numFmt: NF_JO});
    cell("F", r, p.bank, {shrink: true});
    cell("G", r, p.account, {shrink: true, numFmt: "@"});
    cell("H", r, p.note, {shrink: true});
  });
  ws.pageSetup.printArea = `A1:H${last}`;

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}

function joPrintHtml(d) {
  const total = JO_WIDTHS.reduce((a, b) => a + b);
  const fit = v => `<td class="fit" data-size="10">${esc(v)}</td>`;
  const rows = d.rows.map((p, i) => `<tr><td>${i + 1}</td>${fit("관내 출장여비")}${fit(p.grade)}${fit(p.name)}
    <td class="num">${won(p.amount)}</td>${fit(p.bank)}${fit(p.account)}${fit(p.note)}</tr>`).join("");
  return `<div class="jo">
    <h3>${esc(d.title)}</h3>
    <div class="info"><span>부서명 : ${esc(d.dept)}${d.team ? ` (${esc(d.team)})` : ""}</span><span>전화 : ${esc(d.phone)}</span></div>
    <table>
      <colgroup>${JO_WIDTHS.map(w => `<col style="width:${(w / total * 100).toFixed(2)}%">`).join("")}</colgroup>
      <thead><tr><th>연번</th><th>적 &nbsp; 요</th><th>직 급</th><th>성 명</th><th>금 &nbsp; 액</th><th>은행</th><th>계좌번호</th><th>비고</th></tr></thead>
      <tbody>
        <tr class="sum"><td></td><td>합 &emsp;&nbsp; 계</td><td></td><td></td><td class="num">${won(d.total)}</td><td></td><td></td><td></td></tr>
        ${rows}
      </tbody>
    </table></div>`;
}

// ---------- 인쇄용 명세서 ----------
// 엑셀 열 너비 비율을 바탕으로, 글자가 작은 인쇄 화면에서 좁은 칸이 줄바꿈되지 않게 조금 넓힘 (합 100%)
const PRINT_WIDTHS = [4, 8.5, 6.5, 7, 15, 25, 3.5, 5, 5, 6, 8, 6.5];
function printHtml(d) {
  let body = "";
  const rowsTotal = d.people.reduce((s, p) => s + p.trips.length + 1, 0) + 1;
  d.people.forEach((p, pi) => {
    const sum = {n: 0, over: 0, under: 0, car: 0, amt: 0};
    p.trips.forEach((t, i) => {
      sum.n++; sum.over += t.over4h; sum.under += !t.over4h; sum.car += t.car; sum.amt += t.amount;
      body += "<tr>";
      if (pi === 0 && i === 0) body += `<td rowspan="${rowsTotal}"></td>`;
      if (i === 0) body += `<td rowspan="${p.trips.length}">${esc(displayRank(p.rank)).replace("\n", "<br>")}</td>
        <td rowspan="${p.trips.length}">${esc(p.name)}</td>`;
      body += `<td>${md(t)}</td><td class="fit">${esc(t.place)}</td><td class="fit">${esc(t.purpose)}</td><td class="num">1</td>
        <td class="num">${+t.over4h}</td><td class="num">${+!t.over4h}</td><td class="num">${+t.car}</td>
        <td class="num">${won(t.amount)}</td>`;
      if (i === 0) body += `<td rowspan="${p.trips.length}"></td>`;
      body += "</tr>";
    });
    body += `<tr class="sub"><td>소계</td><td></td><td class="days">${sum.n}일</td><td></td><td></td>
      <td class="num">${sum.n}</td><td class="num">${sum.over}</td><td class="num">${sum.under}</td><td class="num">${sum.car}</td>
      <td class="num">${won(sum.amt)}</td><td></td></tr>`;
  });
  body += `<tr class="total"><td class="left" colspan="9">&emsp;합계</td><td class="num">${won(d.total)}</td><td></td></tr>`;
  return `<h3>${esc(d.title)}</h3>
    <div class="cap"><span>1. 청구 및 영수내역</span><span>(단위: 원)</span></div>
    <table>
      <colgroup>${PRINT_WIDTHS.map(w => `<col style="width:${w}%">`).join("")}</colgroup>
      <thead>
        <tr><th colspan="3">출장자</th><th rowspan="2">출장<br>일자</th><th rowspan="2">출장지</th><th rowspan="2">출장목적</th>
          <th colspan="4">출장일수</th><th rowspan="2">청구 및<br>영수금액</th><th rowspan="2">청구 및<br>영수인</th></tr>
        <tr><th>소속</th><th>직급</th><th>성명</th><th>계</th><th>4시간<br>이상</th><th>4시간<br>미만</th><th>공용차량<br>사용</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
    <div class="foot"><div>2. 출장명령 대조일자 : ${esc(d.checkDate)}</div><div>확인자 &nbsp;:&nbsp; ${esc(d.checker)} &nbsp;&nbsp;(인)</div></div>`;
}

function guard(fn) {
  return async () => {
    $("genMsg").innerHTML = "";
    try { await fn(sheetData()); }
    catch (e) { $("genMsg").innerHTML = `<div class="msg err">${esc(e.message || e)}</div>`; }
  };
}
function joGuard(fn) {
  return async () => {
    $("joMsg").innerHTML = "";
    try {
      const d = joData();
      await fn(d);
      if (d.missing.length)
        $("joMsg").innerHTML += `<div class="msg warn">은행·계좌번호가 비어 있는 사람: ${esc(d.missing.join(", "))}</div>`;
    } catch (e) { $("joMsg").innerHTML = `<div class="msg err">${esc(e.message || e)}</div>`; }
  };
}
// landscape: 가로 A4 (집행대장). @page 크기는 인쇄할 때마다 이 style로 바꾼다
function printNow(html, fileName, landscape = false) {
  $("pageSize").textContent = landscape
    ? "@media print { @page { size: A4 landscape; margin: 12mm 8mm 10mm; } }"
    : "@media print { @page { size: A4 portrait; margin: 15mm 10mm 10mm; } }";
  $("tripPrint").innerHTML = html;
  fitPrintCells(landscape ? 281 : 190);
  const old = document.title;
  document.title = fileName;  // PDF로 저장할 때 기본 파일명
  document.body.classList.add("trip-printing");
  window.print();
  document.body.classList.remove("trip-printing");
  document.title = old;
}

$("xlsxBtn").onclick = guard(async d => {
  download(await buildXlsx(d), d.fileName + ".xlsx");
  $("genMsg").innerHTML = `<div class="msg ok">${esc(d.fileName)}.xlsx 을(를) 내려받았습니다. 합계 ${won(d.total)}원</div>`;
});
$("joXlsxBtn").onclick = joGuard(async d => {
  download(await buildJoXlsx(d), d.fileName + ".xlsx");
  $("joMsg").innerHTML = `<div class="msg ok">${esc(d.fileName)}.xlsx 을(를) 내려받았습니다. 합계 ${won(d.total)}원</div>`;
});
$("joPrintBtn").onclick = joGuard(async d => printNow(joPrintHtml(d), d.fileName));
// 출장지·출장목적이 칸보다 길면 한 줄에 들어갈 때까지 글자를 줄이고(6pt까지),
// 그래도 넘치면 7pt로 줄바꿈한다 (행은 저절로 높아짐)
function fitPrintCells(widthMm = 190) {
  const p = $("tripPrint");
  // 화면에서는 숨겨져 있어 크기를 잴 수 없으므로, 인쇄 폭(A4 - 여백)으로 잠깐 화면 밖에 펼친다
  Object.assign(p.style, {display: "block", position: "absolute", left: "-10000px", top: "0", width: widthMm + "mm"});
  for (const td of p.querySelectorAll("td.fit")) {
    let size = +(td.dataset.size || 8);
    td.style.fontSize = size + "pt";
    while (td.scrollWidth > td.clientWidth && size > 6) { size -= 0.25; td.style.fontSize = size + "pt"; }
    if (td.scrollWidth > td.clientWidth) Object.assign(td.style, {fontSize: "7pt", whiteSpace: "normal", wordBreak: "keep-all"});
  }
  p.removeAttribute("style");
}

$("printBtn").onclick = guard(async d => printNow(printHtml(d), d.fileName));

// =====================================================================
// 특근매식비
// =====================================================================

// ---------- 탭 ----------


async function savePdf(html, fileName, {landscape = false, pageSel = null} = {}) {
  const p = $("tripPrint"), widthMm = landscape ? 281 : 190;
  const [left, top] = landscape ? [8, 12] : [10, 15];
  p.innerHTML = html;
  fitPrintCells(widthMm);
  Object.assign(p.style, {display: "block", position: "absolute", left: "-10000px", top: "0", width: widthMm + "mm", background: "#fff"});
  try {
    const pdf = new jspdf.jsPDF({orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4", compress: true});
    const maxH = (landscape ? 210 : 297) - top - 10;
    const pages = pageSel ? [...p.querySelectorAll(pageSel)] : [p];
    for (let i = 0; i < pages.length; i++) {
      // scale 2.5 ≈ 240dpi: 인쇄해도 글자가 선명하면서 JPEG로 한 쪽 수백 KB
      const canvas = await html2canvas(pages[i], {scale: 2.5, backgroundColor: "#ffffff", logging: false});
      let w = widthMm, h = canvas.height * w / canvas.width;
      if (h > maxH) { w = w * maxH / h; h = maxH; }  // 한 쪽보다 길면 줄여서 맞춤
      if (i) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", left + (widthMm - w) / 2, top, w, h);
    }
    // jsPDF의 save()는 내려받기가 막힌 환경에서 data: 주소로 이동해 버리므로, 엑셀과 같은 방식으로 내려받는다
    download(pdf.output("blob"), fileName + ".pdf");
  } finally {
    p.removeAttribute("style");
    p.innerHTML = "";
  }
}


})();
