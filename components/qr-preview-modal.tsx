'use client'

import { Icon } from './ui/icons'
import { Button, CopyField, Modal, Note } from './ui/kit'

/** Увеличенный просмотр QR-кода с загрузкой PNG — общий для «Филиалов» и «QR-кодов». */
export function QrPreviewModal({
  title, sub, imageUrl, url, slug, onClose,
}: {
  title: string
  sub?: string
  imageUrl: string | null
  url?: string
  slug: string
  onClose: () => void
}) {
  return (
    <Modal
      width="narrow"
      title={title}
      sub={sub}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Закрыть</Button>
          {imageUrl && (
            <a href={imageUrl} download={`qr-${slug}.png`} style={{ textDecoration: 'none' }}>
              <span className="btn btn--primary btn--block">
                <Icon name="download" size={16} /> Скачать PNG
              </span>
            </a>
          )}
        </>
      }
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{
          background: '#fff', borderRadius: 'var(--r-lg)', padding: 14,
          display: 'inline-flex', boxShadow: 'var(--sh-2)',
        }}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={`QR-код ${title}`} width={240} height={240}
              style={{ display: 'block', maxWidth: '58vw' }} />
          ) : (
            <div style={{ width: 240, height: 240, display: 'grid', placeItems: 'center', color: '#999', fontSize: 12 }}>
              QR-код не сгенерирован
            </div>
          )}
        </div>
      </div>

      {url && <div style={{ marginTop: 16 }}><CopyField value={url} label="Ссылка QR" /></div>}

      {!imageUrl && (
        <div style={{ marginTop: 14 }}>
          <Note tone="warning">
            Сгенерируйте QR-код кнопкой «Обновить QR» в разделе «Филиалы».
          </Note>
        </div>
      )}
    </Modal>
  )
}
