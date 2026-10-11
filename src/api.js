const API = 'http://localhost:8080/api'

export function getToken() {
  return localStorage.getItem('lifedrop_token')
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API}${path}`, { ...options, headers })
  
  if (response.status === 204) return null

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      localStorage.removeItem('lifedrop_token')
      localStorage.removeItem('lifedrop_user')
    }
    const err = new Error(data?.error || data?.message || `Request failed (${response.status})`)
    err.status = response.status
    err.data = data
    throw err
  }
  return data
}

export async function downloadCsv(path, filename) {
  const token = getToken()
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API}${path}`, { headers })
  if (!response.ok) throw new Error('Failed to download report')
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
