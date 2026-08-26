// design.md 색 토큰. 제목·표지=네이비, 본문=근검정, 브랜드 파랑/초록/앰버 + 콜아웃 틴트.
export const colors = {
  ink: '#111318', text: '#111318', navy: '#0F1B3D',
  canvas: '#ffffff', muted: '#5b6270', line: '#e6e8ee',
  accent: '#2462EB', blue: '#2462EB', green: '#3E9E6E', amber: '#D98A2A',
  // 콜아웃 (design.md §5): 틴트 배경 / 좌측 바
  tintBlue: '#EAF1FE', tintGreen: '#E9F5EF', tintAmber: '#FBF0E1',
  barBlue: '#2462EB', barGreen: '#3E9E6E', barAmber: '#D98A2A',
  // 노트 배경·스티키용 파스텔(별도 역할, 유지)
  blockLime: '#dceeb1', blockLilac: '#e7e3fb', blockCream: '#f5edd8',
  blockMint: '#cdeacf', blockCoral: '#f4d2c1',
} as const
export const fontStack = "-apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', Inter, system-ui, sans-serif"
