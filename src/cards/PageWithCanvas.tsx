import type { Page, Orientation, SizePreset } from '../state/store'
import type { TocItem } from '../builder/util'
import PageView from './PageView'
import FreeLayer from '../canvas/FreeLayer'
import { pageSize } from './sizing'

export interface PageWithCanvasProps {
  page: Page; docTitle: string; orientation: Orientation; size: SizePreset; font: string
  tocItems?: TocItem[]; domId?: string; interactive: boolean
}
export default function PageWithCanvas({ page, docTitle, orientation, size, font, tocItems, domId, interactive }: PageWithCanvasProps) {
  const { W, H, SC } = pageSize(orientation)
  return (
    <div id={domId} style={{ position: 'relative', width: W, height: H }}>
      <PageView page={page} docTitle={docTitle} orientation={orientation} size={size} font={font} tocItems={tocItems} />
      <FreeLayer page={page} W={W} H={H} SC={SC} interactive={interactive} />
    </div>
  )
}
