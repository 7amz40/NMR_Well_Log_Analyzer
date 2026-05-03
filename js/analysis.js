/* global XLSX, Chart, html2canvas */

const CHART_CONFIGS = [
  { key: 'phi',  label: 'Porosity (\u03c6)',                color: '#63b3ed', unit: 'fraction' },
  { key: 'ffi',  label: 'Free Fluid Index (FFI)',       color: '#68d391', unit: '%' },
  { key: 'bfv',  label: 'Bound Fluid Volume (BFV)',     color: '#f6ad55', unit: '%' },
  { key: 'k',    label: 'Permeability (k)',              color: '#fc8181', unit: 'mD' },
  { key: 'rqi',  label: 'Reservoir Quality Index (RQI)', color: '#b794f4', unit: '' },
]

let rawRows = null
let results = null
const charts = {}

function processNMR(rawRows, t2Cutoff, calibrationFactor) {
  const depthMap = new Map()
  for (const r of rawRows) {
    if (!depthMap.has(r.Depth)) depthMap.set(r.Depth, [])
    depthMap.get(r.Depth).push(r)
  }

  return Array.from(depthMap.entries()).map(([depth, bins]) => {
    const sumAmp = bins.reduce((s, b) => s + (b.Amplitude || 0), 0)
    const sumAmpFree = bins
      .filter(b => b.T2 > t2Cutoff)
      .reduce((s, b) => s + (b.Amplitude || 0), 0)

    const phi = calibrationFactor * sumAmp
    const ffiAbs = calibrationFactor * sumAmpFree
    const bvAbs = phi - ffiAbs
    const ffi = phi > 0 ? (ffiAbs / phi) * 100 : 0
    const bfv = phi > 0 ? (bvAbs / phi) * 100 : 0

    const sumAmpLogT2 = bins.reduce((s, b) => s + (b.Amplitude || 0) * Math.log(b.T2 > 0 ? b.T2 : 1), 0)
    const t2LogMean = sumAmp > 0 ? Math.exp(sumAmpLogT2 / sumAmp) : 0

    const k = 4 * Math.pow(t2LogMean, 2) * Math.pow(phi, 4)
    const rqi = phi > 0 ? Math.sqrt(k / phi) : 0

    return {
      depth,
      T2: +t2LogMean.toFixed(4),
      Amplitude: +sumAmp.toFixed(4),
      phi: +phi.toFixed(4),
      ffi: +ffi.toFixed(4),
      bfv: +bfv.toFixed(4),
      k: +k.toFixed(4),
      rqi: +rqi.toFixed(4),
    }
  })
}

function parseFile(file) {
  setError('')
  document.getElementById('dropzone-text').textContent = file.name

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' })

      if (!json.length) { setError('The file is empty.'); return }

      const keys = Object.keys(json[0])
      const depthKey = keys.find(k => /depth/i.test(k))
      const t2Key = keys.find(k => /t2/i.test(k))
      const ampKey = keys.find(k => /amp/i.test(k))

      if (!depthKey || !t2Key) {
        setError('Could not find "Depth" and "T2" columns. Please check your file format.')
        return
      }

      const parsed = json
        .map(r => ({
          Depth: parseFloat(r[depthKey]),
          T2: parseFloat(r[t2Key]),
          Amplitude: ampKey ? parseFloat(r[ampKey]) : NaN,
        }))
        .filter(r => !isNaN(r.Depth) && !isNaN(r.T2))

      if (!parsed.length) { setError('No valid numeric rows found.'); return }

      rawRows = parsed
      const t2Cutoff = parseFloat(document.getElementById('t2-cutoff').value)
      const calibrationFactor = parseFloat(document.getElementById('calib-factor').value)
      results = processNMR(rawRows, t2Cutoff, calibrationFactor)
      renderResults()
    } catch {
      setError('Failed to parse file. Make sure it is a valid Excel or CSV file.')
    }
  }
  reader.readAsArrayBuffer(file)
}

function setError(msg) {
  const el = document.getElementById('error-msg')
  el.textContent = msg
  el.style.display = msg ? 'block' : 'none'
}

function recalculate() {
  if (!rawRows) return
  const t2Cutoff = parseFloat(document.getElementById('t2-cutoff').value)
  const calibrationFactor = parseFloat(document.getElementById('calib-factor').value)
  results = processNMR(rawRows, t2Cutoff, calibrationFactor)
  renderResults()
}

function renderResults() {
  if (!results) return

  const chartData = [...results].sort((a, b) => a.depth - b.depth)

  document.getElementById('empty-state').style.display = 'none'
  document.getElementById('results-section').style.display = 'block'
  document.getElementById('summary-section').style.display = 'block'
  document.getElementById('recalc-btn').disabled = false

  document.getElementById('results-count').textContent = `${results.length} depth points`

  renderSummary(chartData)
  renderCharts(chartData)
  renderTable(chartData)
}

function renderSummary(chartData) {
  const n = chartData.length
  const avg = (key) => (chartData.reduce((s, r) => s + r[key], 0) / n)

  document.getElementById('sum-rows').textContent = n
  document.getElementById('sum-phi').textContent = avg('phi').toFixed(3)
  document.getElementById('sum-ffi').textContent = avg('ffi').toFixed(2) + '%'
  document.getElementById('sum-bfv').textContent = avg('bfv').toFixed(2) + '%'
  document.getElementById('sum-k').textContent = avg('k').toFixed(2)
  document.getElementById('sum-rqi').textContent = avg('rqi').toFixed(3)
}

function renderCharts(chartData) {
  const depths = chartData.map(r => r.depth)

  CHART_CONFIGS.forEach(cfg => {
    const values = chartData.map(r => r[cfg.key])
    const canvasId = `chart-${cfg.key}`
    const canvas = document.getElementById(canvasId)

    if (charts[cfg.key]) {
      charts[cfg.key].destroy()
    }

    charts[cfg.key] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: depths,
        datasets: [{
          data: values,
          borderColor: cfg.color,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            borderColor: 'rgba(99,179,237,0.2)',
            borderWidth: 1,
            callbacks: {
              title: (items) => `Depth: ${items[0].label} m`,
              label: (item) => `${cfg.label}: ${(+item.raw).toFixed(4)}`,
            }
          }
        },
        scales: {
          y: {
            reverse: false,
            title: { display: true, text: 'Depth (m)', color: '#718096', font: { size: 11 } },
            ticks: { color: '#718096', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          x: {
            position: 'top',
            title: { display: true, text: cfg.unit, color: '#718096', font: { size: 11 } },
            ticks: { color: '#718096', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.06)' },
          }
        }
      }
    })
  })
}

function renderTable(chartData) {
  const tbody = document.getElementById('results-tbody')
  tbody.innerHTML = ''
  chartData.forEach(r => {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${r.depth}</td>
      <td>${r.phi}</td>
      <td>${r.ffi}</td>
      <td>${r.bfv}</td>
      <td>${r.k}</td>
      <td>${r.rqi}</td>
    `
    tbody.appendChild(tr)
  })
}

function downloadChart(key) {
  const card = document.getElementById(`card-${key}`)
  html2canvas(card, { backgroundColor: '#111827', scale: 2 }).then(canvas => {
    const link = document.createElement('a')
    link.download = `nmr_${key}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  })
}

function downloadExcel() {
  if (!results) return
  const chartData = [...results].sort((a, b) => a.depth - b.depth)
  const exportData = chartData.map(r => ({
    'Depth (m)': r.depth,
    'Porosity \u03c6': r.phi,
    'FFI (%)': r.ffi,
    'BFV (%)': r.bfv,
    'Permeability k (mD)': r.k,
    'RQI': r.rqi,
  }))
  const ws = XLSX.utils.json_to_sheet(exportData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'NMR Results')
  XLSX.writeFile(wb, 'nmr_results.xlsx')
}

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone')
  const fileInput = document.getElementById('file-input')

  dropzone.addEventListener('click', () => fileInput.click())
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('ap-dropzone--active') })
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('ap-dropzone--active'))
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropzone.classList.remove('ap-dropzone--active')
    const file = e.dataTransfer.files?.[0]
    if (file) parseFile(file)
  })

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  })

  document.getElementById('recalc-btn').addEventListener('click', recalculate)
  document.getElementById('download-excel-btn').addEventListener('click', downloadExcel)

  CHART_CONFIGS.forEach(cfg => {
    const btn = document.getElementById(`dl-btn-${cfg.key}`)
    if (btn) btn.addEventListener('click', () => downloadChart(cfg.key))
  })
})
