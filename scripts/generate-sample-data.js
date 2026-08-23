// 2026-05 ~ 2026-07 가상 판매데이터 331건 생성 (기존 8월 파일과 동일한 형식)
const XLSX = require("xlsx");

// 재현 가능한 난수 (고정 시드)
let s = 20260501;
const rnd = () => {
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return s / 0x7fffffff;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((a, p) => a + p[1], 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) {
    if ((r -= w) <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
};

const PRODUCTS = [
  ["VN 하이드라 세럼 30ml", "스킨케어", 28000],
  ["VN 글로우 앰플 15ml", "스킨케어", 39000],
  ["VN 리페어 크림 50ml", "스킨케어", 34000],
  ["VN 아이 컨투어 크림 20ml", "스킨케어", 31000],
  ["VN 밸런싱 토너 200ml", "스킨케어", 22000],
  ["VN 딥클린 클렌징폼 150ml", "클렌징", 15000],
  ["VN 리프팅 마스크 5매", "마스크", 26000],
  ["VN 비타 마스크팩 10매", "마스크", 18000],
  ["VN 데일리 선크림 50ml", "선케어", 24000],
  ["VN 수딩 젤 100ml", "바디", 17000],
];

const CHANNELS = [
  ["자사몰", "국내", 14],
  ["쿠팡", "국내", 20],
  ["네이버 스마트스토어", "국내", 16],
  ["올리브영 온라인", "국내", 12],
  ["무신사", "국내", 8],
  ["Amazon US", "미국", 12],
  ["Qoo10 JP", "일본", 10],
  ["Shopee SG", "싱가포르", 8],
];

const DISCOUNTS = [1, 1, 0.9, 0.9, 0.85, 0.8];

const START = new Date(Date.UTC(2026, 4, 1)); // 2026-05-01
const DAYS = 92; // 5/1 ~ 7/31
const TOTAL = 331;

const rows = [];
for (let i = 0; i < TOTAL; i++) {
  const day = Math.floor(rnd() * DAYS);
  const d = new Date(START.getTime() + day * 86400000);
  const [channel, region] = weighted(CHANNELS.map((c) => [c, c[2]]));
  const [productName, category, base] = weighted(
    PRODUCTS.map((p, idx) => [p, 12 - idx]),
  );
  const unitPrice = Math.round((base * pick(DISCOUNTS)) / 100) * 100;
  const quantity = weighted([
    [1, 45],
    [2, 30],
    [3, 15],
    [4, 7],
    [5, 3],
  ]);
  rows.push({
    주문일: d,
    판매채널: channel,
    지역: region,
    제품명: productName,
    카테고리: category,
    수량: quantity,
    단가: unitPrice,
    매출액: quantity * unitPrice,
    고객유형: weighted([
      ["신규", 55],
      ["재구매", 45],
    ]),
  });
}

rows.sort((a, b) => a.주문일 - b.주문일);

const header = [
  "주문일",
  "판매채널",
  "지역",
  "제품명",
  "카테고리",
  "수량",
  "단가",
  "매출액",
  "고객유형",
];
const ws = XLSX.utils.json_to_sheet(rows, { header });
// 주문일을 엑셀 날짜(정수 시리얼 + yyyy-mm-dd 서식)로 기록 — 원본 샘플과 동일한 형태
const EPOCH = Date.UTC(1899, 11, 30);
for (let r = 2; r <= rows.length + 1; r++) {
  const serial = Math.round((rows[r - 2].주문일.getTime() - EPOCH) / 86400000);
  ws["A" + r] = { t: "n", v: serial, z: "yyyy-mm-dd" };
}
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "판매데이터");
XLSX.writeFile(wb, process.argv[2]);
console.log("생성 완료:", process.argv[2], rows.length, "행");
console.log(
  "기간:",
  rows[0].주문일.toISOString().slice(0, 10),
  "~",
  rows[rows.length - 1].주문일.toISOString().slice(0, 10),
);
console.log(
  "총 매출액:",
  rows.reduce((a, r) => a + r.매출액, 0).toLocaleString(),
);
