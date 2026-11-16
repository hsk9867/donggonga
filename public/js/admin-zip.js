// 관리자: 시험지 파일 한번에 받기 — 파일을 하나씩 받아 브라우저에서 ZIP(무압축)으로 묶어 내려받는다.
(() => {
  if (window.__dgZip) return;
  window.__dgZip = true;

  const CRC = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const enc = new TextEncoder();

  function dosTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  // entries: [{ path, data: Uint8Array }] → Blob (ZIP, stored, UTF-8 이름)
  function makeZip(entries) {
    const parts = [], central = [];
    let offset = 0;
    const { time, date } = dosTime(new Date());
    for (const e of entries) {
      const name = enc.encode(e.path), crc = crc32(e.data), size = e.data.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, name, e.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
      c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(c.buffer, name);
      offset += 30 + name.length + size;
    }
    const cdSize = central.reduce((n, p) => n + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }

  const mb = (n) => (n / 1048576).toFixed(1) + 'MB';

  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-zip]');
    if (!btn || btn.disabled) return;
    const msg = btn.parentElement.querySelector('[data-zip-msg]');
    const say = (t) => { if (msg) msg.textContent = t; };
    btn.disabled = true;
    try {
      say('파일 목록을 불러오는 중…');
      const r = await fetch(btn.dataset.zip, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('목록을 불러오지 못했습니다. 다시 로그인해 주세요.');
      const { files } = await r.json();
      if (!files.length) { say('받을 파일이 없습니다.'); return; }
      const total = files.reduce((n, f) => n + (f.size || 0), 0);
      const entries = [];
      let got = 0, failed = 0;
      for (let i = 0; i < files.length; i++) {
        say(`내려받는 중… ${i + 1} / ${files.length}개 (${mb(got)} / ${mb(total)})`);
        try {
          const fr = await fetch(files[i].url, { credentials: 'same-origin' });
          if (!fr.ok) throw new Error();
          const data = new Uint8Array(await fr.arrayBuffer());
          got += data.length;
          entries.push({ path: files[i].path, data });
        } catch { failed++; }
      }
      say('ZIP 파일 만드는 중…');
      const blob = makeZip(entries);
      const a = document.createElement('a');
      const d = new Date();
      a.href = URL.createObjectURL(blob);
      a.download = `${btn.dataset.zipName || '시험지'}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      say(`완료: ${entries.length}개 파일 (${mb(blob.size)})${failed ? ` · ${failed}개는 받지 못했습니다` : ''}`);
    } catch (e) {
      say(e.message || '내려받기에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      btn.disabled = false;
    }
  });
})();
