import { expect, test } from '@playwright/test'
import { choiceDescription } from '../src/game/labels'

test('서버의 선택 효과를 능력치 이름과 부호로 표시한다', () => {
  expect(choiceDescription('게임용 선택 효과: {S=-2, A=1}')).toBe('학업 +1 · 스트레스 -2')
  expect(choiceDescription('게임용 선택 효과: {P=2, S=4}')).toBe('프로그래밍 +2 · 스트레스 +4')
  expect(choiceDescription('게임용 선택 효과: {H=5, S=-5}')).toBe('체력 +5 · 스트레스 -5')
  expect(choiceDescription('게임용 선택 효과: {}')).toBe('능력치 변화 없음')
  expect(choiceDescription('면접 답변을 기록합니다.')).toBe('면접 답변을 기록합니다.')
})
