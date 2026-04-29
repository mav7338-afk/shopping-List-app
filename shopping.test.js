const { chromium } = require('playwright');
const path = require('path');

const FILE_URL = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function addItem(page, text) {
  await page.fill('#itemInput', text);
  await page.click('button:has-text("추가")');
  await page.waitForTimeout(100);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // localStorage 초기화 후 페이지 로드
  await page.goto(FILE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // ──────────────────────────────────────
  console.log('\n📋 테스트 1: 초기 상태');
  const emptyMsg = await page.textContent('#list');
  assert(emptyMsg.includes('아직 아이템이 없습니다'), '빈 리스트 안내 메시지 표시');

  // ──────────────────────────────────────
  console.log('\n📋 테스트 2: 아이템 추가');
  await addItem(page, '사과');
  await addItem(page, '바나나');
  await addItem(page, '우유');

  const items = await page.$$('li .item-name');
  assert(items.length === 3, '아이템 3개 추가됨');

  const firstName = await items[0].textContent();
  assert(firstName === '우유', '최신 아이템이 맨 위에 표시됨 (우유)');

  // ──────────────────────────────────────
  console.log('\n📋 테스트 3: Enter 키로 추가');
  await page.fill('#itemInput', '달걀');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);

  const afterEnter = await page.$$('li .item-name');
  assert(afterEnter.length === 4, 'Enter 키로 아이템 추가됨');

  const enterItemName = await afterEnter[0].textContent();
  assert(enterItemName === '달걀', '달걀이 맨 위에 추가됨');

  // ──────────────────────────────────────
  console.log('\n📋 테스트 4: 빈 값 추가 방지');
  const beforeCount = await page.$$('li .item-name');
  await page.fill('#itemInput', '   ');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const afterCount = await page.$$('li .item-name');
  assert(beforeCount.length === afterCount.length, '공백만 있는 입력은 추가되지 않음');

  // ──────────────────────────────────────
  console.log('\n📋 테스트 5: 체크(완료) 기능');
  const checkboxes = await page.$$('li input[type="checkbox"]');
  await checkboxes[0].click();
  await page.waitForTimeout(100);

  const checkedLi = await page.$('li.done');
  assert(checkedLi !== null, '체크 시 li에 done 클래스 추가됨');

  const strikethrough = await page.$eval('li.done .item-name', el =>
    getComputedStyle(el).textDecorationLine
  );
  assert(strikethrough.includes('line-through'), '완료 항목에 취소선 표시됨');

  // 다시 체크 해제 (DOM 재렌더링 후 재쿼리)
  const checkboxes2 = await page.$$('li input[type="checkbox"]');
  await checkboxes2[0].click();
  await page.waitForTimeout(100);
  const uncheckedLi = await page.$('li.done');
  assert(uncheckedLi === null, '체크 해제 시 done 클래스 제거됨');

  // ──────────────────────────────────────
  console.log('\n📋 테스트 6: 아이템 삭제');
  const beforeDel = await page.$$('li .item-name');
  const deleteButtons = await page.$$('.delete-btn');
  await deleteButtons[0].click();
  await page.waitForTimeout(100);
  const afterDel = await page.$$('li .item-name');
  assert(afterDel.length === beforeDel.length - 1, '삭제 버튼으로 아이템 1개 제거됨');

  // ──────────────────────────────────────
  console.log('\n📋 테스트 7: 완료 항목 일괄 삭제');
  // 현재 아이템 전부 체크 (DOM 재렌더링 후 매번 재쿼리)
  const cb1 = await page.$$('li input[type="checkbox"]');
  await cb1[0].click();
  await page.waitForTimeout(100);
  const cb2 = await page.$$('li input[type="checkbox"]');
  await cb2[1].click();
  await page.waitForTimeout(100);

  await page.click('.clear-btn');
  await page.waitForTimeout(100);

  const remaining = await page.$$('li .item-name');
  const doneAfterClear = await page.$$('li.done');
  assert(doneAfterClear.length === 0, '완료 항목 일괄 삭제 후 done 클래스 없음');

  // ──────────────────────────────────────
  console.log('\n📋 테스트 8: 요약 카운터');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await addItem(page, 'A');
  await addItem(page, 'B');
  await addItem(page, 'C');
  const cbList = await page.$$('li input[type="checkbox"]');
  await cbList[0].click();
  await page.waitForTimeout(100);
  const summary = await page.textContent('#summary');
  assert(summary.includes('총 3개'), '요약에 총 아이템 수 표시됨');
  assert(summary.includes('완료 1개'), '요약에 완료 수 표시됨');

  // ──────────────────────────────────────
  console.log('\n📋 테스트 9: localStorage 영속성');
  await page.reload();
  const afterReload = await page.$$('li .item-name');
  assert(afterReload.length === 3, '새로고침 후에도 아이템 유지됨');

  // ──────────────────────────────────────
  console.log('\n' + '─'.repeat(44));
  console.log(`결과: ${passed + failed}개 테스트 중 ✅ ${passed}개 통과, ❌ ${failed}개 실패`);
  if (failed === 0) {
    console.log('🎉 모든 테스트 통과!');
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
