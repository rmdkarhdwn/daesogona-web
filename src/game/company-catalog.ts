import type { CatalogEntry } from '../api/contracts'

// silvally v1.2 data.sql의 COMPANY 행. Render의 범용 카탈로그 조회가 없는 버전에서도 사용한다.
// 지원·점수·기한·합격 판정은 매번 플레이어의 Spring 서버에서 처리한다.
const companies = [
  ['BYTE_WORKS', '바이트웍스', 'BACKEND'], ['PIXEL_LAB', '픽셀랩', 'WEB'],
  ['DROID_FACTORY', '드로이드팩토리', 'ANDROID'], ['DUNGEON_GAMES', '던전게임즈', 'GAME'],
  ['DEEP_MIND_KR', '딥마인드코리아', 'AI'], ['AI_WORKS', '에이아이웍스', 'AI_NATIVE'],
] as const

export const companiesV12: CatalogEntry[] = companies.map(([code, title, role]) => ({ code, title, details: { role } }))
export const companyNames = Object.fromEntries(companies.map(([code, title]) => [code, title]))
