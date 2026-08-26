import { useState } from 'react'
import './chrome.css'
import TitleBar from './chrome/TitleBar'
import MenuBar from './chrome/MenuBar'
import EditToolbar from './chrome/EditToolbar'
import ClassicBar from './chrome/ClassicBar'
import type { ClassicBarHandle } from './chrome/ClassicBar'
import RightPanel from './chrome/RightPanel'
import Filmstrip from './Filmstrip'
import Preview from './Preview'
import ExportLayer from './ExportLayer'
import Help from './Help'
import Dock from './Dock'
import Present from './Present'
import TutorialCoach from './TutorialCoach'
import Hotkeys from './Hotkeys'
import SettingsPage from '../settings/SettingsPage'
import ChatPanel from '../chat/ChatPanel'
import { applyUiAction } from '../chat/actions'
import DemoPlayer from './DemoPlayer'
import AiCleanup from './AiCleanup'
import { useRef, useEffect } from 'react'
import { useBuilder } from '../state/store'

export default function Layout() {
  const [help, setHelp] = useState(false)
  const [present, setPresent] = useState(false)
  const [tutorial, setTutorial] = useState(false)
  const [settings, setSettings] = useState(false)
  const [chat, setChat] = useState(false)
  const [demo, setDemo] = useState(false)
  const [ai, setAi] = useState(false)
  const classicRef = useRef<ClassicBarHandle>(null)
  const addCard = useBuilder((s) => s.addCard)

  useEffect(() => {
    const h = () => setPresent(true)
    const imp = () => classicRef.current?.openImport()
    window.addEventListener('ebook:present', h)
    window.addEventListener('ebook:import', imp)
    return () => { window.removeEventListener('ebook:present', h); window.removeEventListener('ebook:import', imp) }
  }, [])

  return (<div className="ax-app">
    <Hotkeys
      presentOpen={present} helpOpen={help} tutorialOpen={tutorial}
      onBuild={() => window.dispatchEvent(new CustomEvent('ebook:build'))}
      onPresent={() => setPresent(true)} onHelp={() => setHelp(true)}
      onCloseHelp={() => setHelp(false)} onCloseTutorial={() => setTutorial(false)}
    />
    <TitleBar onPresent={() => setPresent(true)} />
    <MenuBar onHelp={() => setHelp(true)} onSettings={() => setSettings(true)} onImport={() => classicRef.current?.openImport()} onPresent={() => setPresent(true)} />
    <EditToolbar />
    <ClassicBar ref={classicRef} onSettings={() => setSettings(true)} onDemo={() => setDemo(true)} onAiCleanup={() => setAi(true)} />

    <div className="ax-body">
      <div className="ax-film">
        <button className="add" onClick={() => addCard('slide')}>＋ 새 슬라이드</button>
        <Filmstrip />
      </div>
      <div className="ax-stage-wrap"><Preview /></div>
      <RightPanel />
    </div>

    <Dock />
    <ExportLayer />
    <Help open={help} onClose={() => setHelp(false)} onStartTutorial={() => { setHelp(false); setTutorial(true) }} />
    <Present open={present} onClose={() => setPresent(false)} />
    <TutorialCoach open={tutorial} onClose={() => setTutorial(false)} />
    {settings ? (
      <div className="scrim on settings-scrim" onClick={(e) => { if ((e.target as HTMLElement).classList.contains('scrim')) setSettings(false) }}>
        <div className="settings-modal">
          <button className="close" onClick={() => setSettings(false)}>확인</button>
          <SettingsPage />
        </div>
      </div>
    ) : null}
    {!chat ? <button className="chat-fab" onClick={() => setChat(true)}>💬 이북 도우미</button> : null}
    <ChatPanel isOpen={chat} onClose={() => setChat(false)} screenContext={{ page: 'builder' }} onUiAction={applyUiAction} />
    <DemoPlayer open={demo} onClose={() => setDemo(false)} />
    <AiCleanup open={ai} onClose={() => setAi(false)} />
  </div>)
}
