import { useEffect, useRef } from 'react'
import Layout from './builder/Layout'
import { useBuilder } from './state/store'
export default function App() {
  const addCard = useBuilder((s) => s.addCard)
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    addCard('slide')  // 구글 슬라이드식: 빈 슬라이드 한 장으로 시작
  }, [addCard])
  return <Layout />
}
