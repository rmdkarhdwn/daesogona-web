import { expect, test } from '@playwright/test'
import { graduationMemories } from '../src/game/graduation-memories'

test('졸업 요약만 남은 회차도 실제 진로에 맞는 마지막 장면을 본다', () => {
  const routes = [
    ['EMPLOYMENT', '희망 직무 취업', 'commute'],
    ['UNEMPLOYED', '미취업 졸업', 'notebook'],
    ['INDIE_DEV', '개인 개발 준비', 'workbench'],
    ['UNIVERSITY', '진학 준비', 'notebook'],
  ] as const
  for (const [selectedPath, title, shot] of routes) {
    const career = selectedPath === 'EMPLOYMENT' ? { acceptedCompany: 'PIXEL_LAB', acceptedRole: 'WEB' } : {}
    const scenes = graduationMemories({}, [], { selectedPath, title, ...career })
    expect(scenes[0].shot).toBe('campus')
    expect(scenes.at(-1)).toMatchObject({ title, shot })
    expect(scenes.at(-1)?.text.includes('픽셀랩')).toBe(selectedPath === 'EMPLOYMENT')
  }
})
