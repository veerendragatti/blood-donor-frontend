import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api, getToken, downloadCsv } from './api'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const COMPONENTS = [
  { value: 'WHOLE_BLOOD', label: 'Whole Blood (All Components)' },
  { value: 'RED_CELLS', label: 'Packed Red Blood Cells (RBC)' },
  { value: 'PLASMA', label: 'Fresh Frozen Plasma' },
  { value: 'PLATELETS', label: 'Platelet Concentrate' }
]

const initialUser = () => {
  try {
    return JSON.parse(localStorage.getItem('lifedrop_user') || 'null')
  } catch {
    return null
  }
}

export default function App() {
  const [user, setUser] = useState(initialUser)
  const [page, setPage] = useState('home') // home, search, verify, privacy, auth, dashboard
  const [activeTab, setActiveTab] = useState('overview')
  const [toast, setToast] = useState({ message: '', type: 'info' })
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState(null)

  // Dark Mode Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('lifedrop_theme') || 'light')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('lifedrop_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light')

  // Sidebar collapse & Mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Notification state
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  // Modals & confirmation dialogs
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [timelineModalData, setTimelineModalData] = useState(null) // { requestId, events: [], loading: boolean }

  // Public search state
  const [searchFilter, setSearchFilter] = useState({ bloodGroup: '', location: '', component: 'WHOLE_BLOOD' })
  const [searchResults, setSearchResults] = useState([])
  const [searchSearched, setSearchSearched] = useState(false)

  // Verification state
  const [verifyTokenInput, setVerifyTokenInput] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)

  // Auth form state
  const [authMode, setAuthMode] = useState('login')
  const [authTargetPortal, setAuthTargetPortal] = useState('user') // 'user' | 'hospital'
  const [authForm, setAuthForm] = useState({
    name: '', email: '', password: '', role: 'DONOR', phone: '', city: '', district: '', bloodGroup: 'O+'
  })
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // Donor states
  const [donorCard, setDonorCard] = useState(null)
  const [donorQrDataUrl, setDonorQrDataUrl] = useState('')
  const [donorProfile, setDonorProfile] = useState({ name: '', phone: '', city: '', district: '', bloodGroup: 'O+', verificationCode: '' })
  const [donorPrivacy, setDonorPrivacy] = useState({ allowDiscovery: true, allowNotifications: true, allowEmailNotifications: false, allowSmsNotifications: false })
  const [matchedRequests, setMatchedRequests] = useState([])
  const [donationHistory, setDonationHistory] = useState({ donations: [], totalUnits: 0, lastDonationDate: '', nextEligibleDate: '', disclaimer: '' })

  // Requester & Unified Portal states
  const [userPortalMode, setUserPortalMode] = useState('donor') // 'donor' | 'requester'
  const [myRequesterRequests, setMyRequesterRequests] = useState([])
  const [requesterForm, setRequesterForm] = useState({
    patientName: '', bloodGroup: 'O+', component: 'WHOLE_BLOOD', unitsRequired: 1, city: '', hospitalLocation: '',
    requesterPhone: '', notes: '', priority: 'NORMAL', emergencyReason: '', requiredDate: new Date().toISOString().split('T')[0]
  })

  // Hospital states
  const [hospitalRequests, setHospitalRequests] = useState([])
  const [mediationRequests, setMediationRequests] = useState([])
  const [hospitalDonors, setHospitalDonors] = useState([])
  const [selectedMediationReq, setSelectedMediationReq] = useState(null)
  const [mediationMatches, setMediationMatches] = useState([])
  const [mediationModalOpen, setMediationModalOpen] = useState(false)
  const [sendAvailableModalData, setSendAvailableModalData] = useState(null)
  const [mediationQueueFilter, setMediationQueueFilter] = useState('active')
  const [notAvailableReasonInput, setNotAvailableReasonInput] = useState('')
  const [notAvailableModalReqId, setNotAvailableModalReqId] = useState(null)
  const [selectedRequestMatches, setSelectedRequestMatches] = useState([])
  const [selectedRequestResponses, setSelectedRequestResponses] = useState([])
  const [viewingRequestId, setViewingRequestId] = useState(null)
  const [createReqForm, setCreateReqForm] = useState({
    bloodGroup: 'O+', component: 'WHOLE_BLOOD', unitsRequired: 1, city: '', hospitalLocation: '',
    notes: '', priority: 'NORMAL', emergencyReason: '', requiredDate: new Date().toISOString().split('T')[0]
  })
  const [confirmDonationForm, setConfirmDonationForm] = useState({
    donorId: '', bloodRequestId: '', unitsDonated: 1, donationDate: new Date().toISOString().split('T')[0], component: 'WHOLE_BLOOD', notes: ''
  })
  const [hospitalDonations, setHospitalDonations] = useState([])
  const [hospitalFulfilledRequests, setHospitalFulfilledRequests] = useState([])
  const [recordsSubTab, setRecordsSubTab] = useState('donated') // 'donated' | 'fulfilled'
  const [recordsSearchQuery, setRecordsSearchQuery] = useState('')
  const [recordsBloodGroupFilter, setRecordsBloodGroupFilter] = useState('')

  // Admin states
  const [adminSummary, setAdminSummary] = useState(null)
  const [adminRequests, setAdminRequests] = useState([])
  const [adminUsers, setAdminUsers] = useState([])
  const [adminAuditLogs, setAdminAuditLogs] = useState([])

  const flash = (message, type = 'success') => {
    setToast({ message, type })
    if (message) {
      setTimeout(() => setToast({ message: '', type: 'info' }), 6000)
    }
  }

  const run = async (fn) => {
    setLoading(true)
    setPageError(null)
    try {
      await fn()
    } catch (e) {
      setPageError(e.message || 'Operation failed')
      flash(e.message || 'Operation failed', 'danger')
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('lifedrop_token')
    localStorage.removeItem('lifedrop_user')
    setUser(null)
    setPage('home')
    setShowNotifPanel(false)
    flash('You have been safely logged out.')
  }

  // Periodic Notification Polling
  const fetchNotifications = async () => {
    if (!getToken() || !user) return
    try {
      const [list, countRes] = await Promise.all([
        api('/notifications?limit=15'),
        api('/notifications/unread-count')
      ])
      setNotifications(list || [])
      setUnreadCount(countRes?.unreadCount || 0)
    } catch (err) {}
  }

  useEffect(() => {
    if (user) {
      fetchNotifications()
      const interval = setInterval(fetchNotifications, 15000)
      return () => clearInterval(interval)
    }
  }, [user?.id])

  const markAllRead = async () => {
    try {
      await api('/notifications/read-all', { method: 'PATCH' })
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      flash('All notifications marked as read.')
    } catch (e) {
      flash(e.message, 'danger')
    }
  }

  const markSingleRead = async (id) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (e) {}
  }

  // Load dashboard data based on role
  const loadDashboard = async () => {
    if (!user) return
    await run(async () => {
      if (user.role === 'DONOR') {
        const [prof, card, priv, matched, hist, reqs] = await Promise.all([
          api('/donors/me'),
          api('/donors/me/card'),
          api('/donors/me/privacy'),
          api('/donors/me/matched-requests'),
          api('/donations/mine'),
          api('/requester/requests')
        ])
        setDonorProfile(prof)
        setDonorCard(card)
        setDonorPrivacy(priv)
        setMatchedRequests(matched || [])
        setDonationHistory(hist || {})
        setMyRequesterRequests(reqs || [])
        if (!requesterForm.city && prof?.city) {
          setRequesterForm(prev => ({ ...prev, city: prof.city, requesterPhone: prof.phone || '' }))
        }

        if (card?.qrToken) {
          const verifyUrl = `${window.location.origin}/verify?token=${card.qrToken}`
          const url = await QRCode.toDataURL(verifyUrl, { width: 220, margin: 1 })
          setDonorQrDataUrl(url)
        }
      } else if (user.role === 'HOSPITAL') {
        const [reqs, medReqs, donors, dons, fulfilled] = await Promise.all([
          api('/requests/mine'),
          api('/hospital/mediation-requests'),
          api('/hospital/donors').catch(() => []),
          api('/donations/hospital').catch(() => []),
          api('/hospital/records/fulfilled').catch(() => [])
        ])
        setHospitalRequests(reqs || [])
        setMediationRequests(medReqs || [])
        setHospitalDonors(donors || [])
        setHospitalDonations(dons || [])
        setHospitalFulfilledRequests(fulfilled || [])
        if (!createReqForm.city && user.city) {
          setCreateReqForm(prev => ({ ...prev, city: user.city }))
        }
      } else if (user.role === 'ADMIN') {
        const [sum, reqs, users, logs] = await Promise.all([
          api('/admin/summary'),
          api('/admin/requests'),
          api('/admin/users'),
          api('/admin/audit-logs')
        ])
        setAdminSummary(sum)
        setAdminRequests(reqs || [])
        setAdminUsers(users || [])
        setAdminAuditLogs(logs || [])
      }
    })
  }

  useEffect(() => {
    if (page === 'dashboard' && user) {
      loadDashboard()
    }
  }, [page, user?.id])

  // Public Donor Search
  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    await run(async () => {
      const q = new URLSearchParams()
      if (searchFilter.bloodGroup) q.set('bloodGroup', searchFilter.bloodGroup)
      if (searchFilter.location) q.set('location', searchFilter.location)
      if (searchFilter.component) q.set('component', searchFilter.component)
      const data = await api(`/donors/search?${q.toString()}`)
      setSearchResults(data || [])
      setSearchSearched(true)
      setPage('search')
    })
  }

  // Token Verification
  const handleVerify = async (tokenToTest) => {
    const t = tokenToTest || verifyTokenInput
    if (!t) return
    await run(async () => {
      const res = await api(`/verify/card/${encodeURIComponent(t.trim())}`)
      setVerifyResult(res)
    })
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenParam = params.get('token')
    if (tokenParam) {
      setPage('verify')
      setVerifyTokenInput(tokenParam)
      handleVerify(tokenParam)
    }
  }, [])

  // View visual request timeline
  const handleViewTimeline = async (requestId) => {
    setTimelineModalData({ requestId, events: [], loading: true })
    try {
      const events = await api(`/requests/${requestId}/timeline`)
      setTimelineModalData({ requestId, events: events || [], loading: false })
    } catch (e) {
      flash('Failed to load timeline: ' + e.message, 'danger')
      setTimelineModalData(null)
    }
  }

  // Auth submission
  const handleAuthSubmit = async (e) => {
    e.preventDefault()

    // STRICT CHECK FOR HOSPITAL PORTAL: ONLY hospital@apollo.org can be verified!
    if (authTargetPortal === 'hospital') {
      const emailEntered = authForm.email.trim().toLowerCase();
      if (emailEntered !== 'hospital@apollo.org') {
        flash('Access Denied: Only the authorized hospital email (hospital@apollo.org) is verified for the Hospital Portal. Regular user accounts cannot access or open the Hospital Portal.', 'danger');
        return;
      }
    }

    if (authMode === 'register' && authForm.role === 'HOSPITAL' && authForm.email.trim().toLowerCase() !== 'hospital@apollo.org') {
      flash('Registration rejected: Only the authorized email (hospital@apollo.org) is permitted for Hospital Portal.', 'danger')
      return
    }
    await run(async () => {
      if (authMode === 'register') {
        const res = await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify(authForm)
        })
        localStorage.setItem('lifedrop_token', res.token)
        localStorage.setItem('lifedrop_user', JSON.stringify(res.user))
        setUser(res.user)
        setPage('dashboard')
        flash(`Welcome to LifeDrop, ${res.user.name}!`)
      } else if (authMode === 'login') {
        const res = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: authForm.email,
            password: authForm.password,
            portal: authTargetPortal === 'hospital' ? 'HOSPITAL' : 'USER'
          })
        })

        // Ensure user account never opens under hospital portal
        if (authTargetPortal === 'hospital' && res.user.role !== 'HOSPITAL') {
          flash('Access Denied: Regular user accounts cannot open the Hospital Portal.', 'danger');
          return;
        }

        localStorage.setItem('lifedrop_token', res.token)
        localStorage.setItem('lifedrop_user', JSON.stringify(res.user))
        setUser(res.user)
        setPage('dashboard')
        flash(`Welcome back, ${res.user.name}!`)
      } else if (authMode === 'forgot') {
        const res = await api('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: authForm.email })
        })
        flash(res.message)
        if (res.demoResetToken) {
          setResetToken(res.demoResetToken)
          setAuthMode('reset')
          flash(`Password reset token generated: ${res.demoResetToken}. Set your new password below.`, 'warning')
        }
      } else if (authMode === 'reset') {
        const res = await api('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, newPassword })
        })
        flash(res.message)
        setAuthMode('login')
      }
    })
  }

  // Requester operations
  const handleCreateRequesterRequest = async (e) => {
    if (e) e.preventDefault()
    await run(async () => {
      const body = {
        ...requesterForm,
        unitsRequired: Number(requesterForm.unitsRequired)
      }
      await api('/requester/requests', {
        method: 'POST',
        body: JSON.stringify(body)
      })
      flash('Blood request successfully dispatched to Apollo City Hospital mediator! You will receive live alerts as the hospital searches and coordinates with donors.')
      setRequesterForm({
        patientName: '', bloodGroup: 'O+', component: 'WHOLE_BLOOD', unitsRequired: 1, city: user?.city || '',
        hospitalLocation: '', requesterPhone: user?.phone || '', notes: '', priority: 'NORMAL', emergencyReason: '',
        requiredDate: new Date().toISOString().split('T')[0]
      })
      const reqs = await api('/requester/requests')
      setMyRequesterRequests(reqs || [])
      setActiveTab('requester-my-requests')
    })
  }

  // Hospital Mediation & Donor Management operations
  const fetchHospitalDonors = async () => {
    try {
      const donors = await api('/hospital/donors')
      setHospitalDonors(donors || [])
    } catch (err) {
      flash(err.message || 'Failed to load donors', 'error')
    }
  }

  const fetchHospitalRecords = async () => {
    try {
      const [dons, fulfilled] = await Promise.all([
        api('/donations/hospital').catch(() => []),
        api('/hospital/records/fulfilled').catch(() => [])
      ])
      setHospitalDonations(dons || [])
      setHospitalFulfilledRequests(fulfilled || [])
    } catch (e) {
      console.error(e)
    }
  }

  const handleRemoveDonor = (donor) => {
    setConfirmDialog({
      title: 'Remove Donor from Network',
      message: `Are you sure you want to permanently remove donor "${donor.name}" (${donor.email})? This action will unlink any associated blood requests and delete their account from the donor database.`,
      actionLabel: 'Remove Donor',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null)
        await run(async () => {
          const res = await api(`/hospital/donors/${donor.id}`, { method: 'DELETE' })
          flash(res.message || 'Donor successfully removed.')
          fetchHospitalDonors()
          const medReqs = await api('/hospital/mediation-requests')
          setMediationRequests(medReqs || [])
        })
      }
    })
  }

  const handleSearchMediationDonors = async (reqItem) => {
    setSelectedMediationReq(reqItem)
    setMediationModalOpen(true)
    await run(async () => {
      try {
        const checkRes = await api(`/hospital/requests/${reqItem.id}/check-donors`)
        if (checkRes && checkRes.donors && checkRes.donors.length > 0) {
          setMediationMatches(checkRes.donors.map(d => ({
            id: d.id,
            displayName: d.name,
            bloodGroup: d.bloodGroup,
            city: d.city,
            phone: d.phone,
            cooldownMet: true,
            matchScore: 100
          })))
          return
        }
      } catch (e) {
        // Fallback
      }
      const q = new URLSearchParams()
      if (reqItem.bloodGroup) q.set('bloodGroup', reqItem.bloodGroup)
      if (reqItem.city) q.set('location', reqItem.city)
      if (reqItem.component) q.set('component', reqItem.component)
      const matches = await api(`/donors/search?${q.toString()}`)
      setMediationMatches(matches || [])
    })
  }

  const handleSendRequestToDonor = async (reqId, donorId, donorName) => {
    await run(async () => {
      await api(`/hospital/requests/${reqId}/send-to-donor/${donorId}`, { method: 'POST' })
      flash(`Donation request sent to donor ${donorName}! Donor notified in portal. Requester has been updated that a candidate donor was contacted.`)
      setMediationModalOpen(false)
      const medReqs = await api('/hospital/mediation-requests')
      setMediationRequests(medReqs || [])
      fetchHospitalRecords()
    })
  }

  const handleSendNotAvailableAlert = async (reqId) => {
    await run(async () => {
      await api(`/hospital/requests/${reqId}/send-not-available?reason=${encodeURIComponent(notAvailableReasonInput || 'No matching active donors available')}`, {
        method: 'POST'
      })
      flash(`⚠️ Not Available alert sent to requester for request #${reqId}. Requester received instant notification.`)
      setNotAvailableModalReqId(null)
      setNotAvailableReasonInput('')
      const medReqs = await api('/hospital/mediation-requests')
      setMediationRequests(medReqs || [])
    })
  }

  const handleOpenSendAvailableModal = (r) => {
    const defaultMsg = `Hospital Notification: Donor ${r.assignedDonorName} (${r.bloodGroup}) has agreed to donate blood for patient ${r.patientName || 'in need'}. Contact details are provided to coordinate arrival.`
    setSendAvailableModalData({
      reqId: r.id,
      patientName: r.patientName,
      donorName: r.assignedDonorName,
      donorPhone: r.assignedDonorPhone,
      donorBloodGroup: r.bloodGroup
    })
    setAvailableCustomMessage(defaultMsg)
  }

  const handleConfirmSendAvailableAlert = async () => {
    if (!sendAvailableModalData) return
    await run(async () => {
      await api(`/hospital/requests/${sendAvailableModalData.reqId}/send-available-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: availableCustomMessage })
      })
      flash(`🎉 Available Alert sent to requester with donor details! Requester can now view donor contact info.`)
      setSendAvailableModalData(null)
      setAvailableCustomMessage('')
      const medReqs = await api('/hospital/mediation-requests')
      setMediationRequests(medReqs || [])
    })
  }

  const handleClearMediationRequest = async (reqId) => {
    await run(async () => {
      await api(`/hospital/requests/${reqId}/clear`, { method: 'POST' })
      flash(`✓ Request #${reqId} cleared from active queue.`)
      const medReqs = await api('/hospital/mediation-requests')
      setMediationRequests(medReqs || [])
    })
  }

  const handleClearAllSatisfied = async (satisfiedIds) => {
    await run(async () => {
      for (const id of satisfiedIds) {
        await api(`/hospital/requests/${id}/clear`, { method: 'POST' })
      }
      flash(`✓ All ${satisfiedIds.length} satisfied requests cleared from active queue.`)
      const medReqs = await api('/hospital/mediation-requests')
      setMediationRequests(medReqs || [])
    })
  }

  const handleUnclearMediationRequest = async (reqId) => {
    await run(async () => {
      await api(`/hospital/requests/${reqId}/unclear`, { method: 'POST' })
      flash(`Request #${reqId} restored to active mediation queue.`)
      const medReqs = await api('/hospital/mediation-requests')
      setMediationRequests(medReqs || [])
    })
  }

  // Donor operations
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    await run(async () => {
      const updated = await api('/donors/me', {
        method: 'PUT',
        body: JSON.stringify(donorProfile)
      })
      setUser(prev => ({ ...prev, ...updated }))
      localStorage.setItem('lifedrop_user', JSON.stringify({ ...user, ...updated }))
      flash('Profile updated successfully.')
    })
  }

  const handleToggleAvailability = async () => {
    await run(async () => {
      const updated = await api(`/donors/me/availability?available=${!user.available}`, { method: 'PATCH' })
      setUser(prev => ({ ...prev, available: updated.available }))
      localStorage.setItem('lifedrop_user', JSON.stringify({ ...user, available: updated.available }))
      flash(`Availability updated to: ${updated.available ? 'Available' : 'Paused'}`)
    })
  }

  const handleSavePrivacy = async (e) => {
    e.preventDefault()
    await run(async () => {
      const updated = await api('/donors/me/privacy', {
        method: 'PUT',
        body: JSON.stringify(donorPrivacy)
      })
      setDonorPrivacy(updated)
      flash('Consent and privacy preferences saved.')
    })
  }

  const handleRegenerateQrToken = () => {
    setConfirmDialog({
      title: 'Regenerate Digital Pass QR Code',
      message: 'Regenerating will immediately invalidate any previously saved or printed QR codes. Are you sure you wish to continue?',
      actionLabel: 'Yes, Regenerate QR Code',
      onConfirm: async () => {
        setConfirmDialog(null)
        await run(async () => {
          const res = await api('/donors/me/card/regenerate-token', { method: 'POST' })
          setDonorCard(prev => ({ ...prev, qrToken: res.qrToken }))
          const verifyUrl = `${window.location.origin}/verify?token=${res.qrToken}`
          const url = await QRCode.toDataURL(verifyUrl, { width: 220, margin: 1 })
          setDonorQrDataUrl(url)
          flash(res.message)
        })
      }
    })
  }

  const handleDonorRespond = async (requestId, status) => {
    // Optimistically disable the request card immediately for DECLINED
    if (status === 'DECLINED') {
      setMatchedRequests(prev =>
        prev.map(r => r.id === requestId ? { ...r, donorResponseStatus: 'DECLINED' } : r)
      )
    }
    await run(async () => {
      await api(`/donors/me/respond-request/${requestId}`, {
        method: 'POST',
        body: JSON.stringify({ status, notes: `Donor responded ${status} from web application` })
      })
      if (status === 'DECLINED') {
        flash(`You declined request #${requestId}. The hospital has been notified. This request is now disabled in your portal.`)
      } else if (status === 'ACCEPTED') {
        flash(`🎉 Thank you! You accepted blood request #${requestId}. Your contact details have been unlocked and dispatched to both the hospital and requester.`, 'success')
      } else {
        flash(`You marked request #${requestId} as: ${status}. The requesting hospital has been notified.`)
      }
      const matched = await api('/donors/me/matched-requests')
      setMatchedRequests(matched || [])
    })
  }

  // Hospital operations
  const handleCreateRequest = async (e, confirmDuplicateOverride = false) => {
    if (e) e.preventDefault()
    await run(async () => {
      try {
        const body = {
          ...createReqForm,
          unitsRequired: Number(createReqForm.unitsRequired),
          confirmDuplicate: confirmDuplicateOverride
        }
        await api('/requests', {
          method: 'POST',
          body: JSON.stringify(body)
        })
        flash('Blood request created successfully. Matching discoverable donors have been alerted via in-app notifications.')
        setDuplicateWarning(null)
        setCreateReqForm({
          bloodGroup: 'O+', component: 'WHOLE_BLOOD', unitsRequired: 1, city: user.city || '', hospitalLocation: '',
          notes: '', priority: 'NORMAL', emergencyReason: '', requiredDate: new Date().toISOString().split('T')[0]
        })
        const reqs = await api('/requests/mine')
        setHospitalRequests(reqs || [])
        setActiveTab('requests')
      } catch (err) {
        if (err.status === 409 && err.data?.isDuplicate) {
          setDuplicateWarning(err.data)
        } else {
          throw err
        }
      }
    })
  }

  const handleViewRequestMatches = async (reqId) => {
    await run(async () => {
      setViewingRequestId(reqId)
      const [matches, responses] = await Promise.all([
        api(`/requests/${reqId}/matches`),
        api(`/requests/${reqId}/responses`)
      ])
      setSelectedRequestMatches(matches || [])
      setSelectedRequestResponses(responses || [])
      setActiveTab('matching')
    })
  }

  const handleUpdateHospitalRequestStatus = async (id, status) => {
    await run(async () => {
      await api(`/requests/${id}/status?status=${status}`, { method: 'PATCH' })
      flash(`Request #${id} status changed to ${status}.`)
      const reqs = await api('/requests/mine')
      setHospitalRequests(reqs || [])
    })
  }

  const handleConfirmDonation = async (e) => {
    e.preventDefault()
    await run(async () => {
      const res = await api('/donations/confirm', {
        method: 'POST',
        body: JSON.stringify({
          donorId: Number(confirmDonationForm.donorId),
          bloodRequestId: confirmDonationForm.bloodRequestId ? Number(confirmDonationForm.bloodRequestId) : null,
          unitsDonated: Number(confirmDonationForm.unitsDonated),
          donationDate: confirmDonationForm.donationDate,
          component: confirmDonationForm.component,
          notes: confirmDonationForm.notes
        })
      })
      flash(`Donation confirmed successfully! Record #${res.id} created for donor #${res.donorId}.`)
      fetchHospitalRecords()
      setConfirmDonationForm({
        donorId: '', bloodRequestId: '', unitsDonated: 1, donationDate: new Date().toISOString().split('T')[0], component: 'WHOLE_BLOOD', notes: ''
      })
      const reqs = await api('/requests/mine')
      setHospitalRequests(reqs || [])
      setActiveTab('requests')
    })
  }

  // Admin operations
  const handleAdminUpdateStatus = async (id, status) => {
    await run(async () => {
      await api(`/admin/requests/${id}/status?status=${status}`, { method: 'PATCH' })
      flash(`Request #${id} status changed to ${status}.`)
      const reqs = await api('/admin/requests')
      setAdminRequests(reqs || [])
    })
  }

  const handleAdminUpdatePriority = async (id, priority) => {
    await run(async () => {
      await api(`/admin/requests/${id}/priority?priority=${priority}`, { method: 'PATCH' })
      flash(`Request #${id} priority updated to ${priority}.`)
      const reqs = await api('/admin/requests')
      setAdminRequests(reqs || [])
    })
  }

  const handleAdminUserStatus = async (userId, newStatus) => {
    setConfirmDialog({
      title: `${newStatus === 'SUSPENDED' ? 'Suspend' : 'Activate'} User Account`,
      message: `Are you sure you want to change user #${userId} status to ${newStatus}?`,
      actionLabel: `Confirm ${newStatus}`,
      onConfirm: async () => {
        setConfirmDialog(null)
        await run(async () => {
          await api(`/admin/users/${userId}/status?status=${newStatus}`, { method: 'PATCH' })
          flash(`User #${userId} status updated to ${newStatus}.`)
          const users = await api('/admin/users')
          setAdminUsers(users || [])
        })
      }
    })
  }

  return (
    <div className="app-container">
      {/* Top Emergency Advisory Banner */}
      <div className="emergency-alert-banner">
        <span>
          <strong>🚨 CLINICAL NOTICE:</strong> LifeDrop coordinates volunteer blood donations and is not an emergency response dispatch service. For life-threatening emergencies, dial <b>108 / 911</b> or contact a licensed hospital blood bank directly.
        </span>
        <button onClick={() => setPage('privacy')}>Privacy & Clinical Guidelines</button>
      </div>

      {/* Main Header */}
      <header className="header-nav">
        <button className="brand-wrapper" onClick={() => setPage('home')}>
          <div className="brand-icon-box">✚</div>
          <div>
            <span className="brand-name">LifeDrop</span>
            <small className="brand-sub">Blood Donor Management System</small>
          </div>
        </button>

        <nav className="nav-links-center">
          <button className={`nav-item-btn ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>Home</button>
          <button className={`nav-item-btn ${page === 'search' ? 'active' : ''}`} onClick={() => setPage('search')}>Find Donors</button>
          <button className={`nav-item-btn ${page === 'verify' ? 'active' : ''}`} onClick={() => setPage('verify')}>Verify QR Pass</button>
          <button className={`nav-item-btn ${page === 'privacy' ? 'active' : ''}`} onClick={() => setPage('privacy')}>Privacy</button>
          {user && (
            <button className={`nav-item-btn ${page === 'dashboard' ? 'active' : ''}`} onClick={() => setPage('dashboard')}>
              Dashboard ({user.role === 'DONOR' ? (userPortalMode === 'donor' ? 'Donor Mode' : 'Requester Mode') : user.role})
            </button>
          )}
        </nav>

        <div className="nav-right-actions">
          {/* Dark Mode Switch */}
          <button className="theme-toggle-btn" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {user ? (
            <>
              {/* Notification Center Bell */}
              <button className="notif-bell-btn" onClick={() => setShowNotifPanel(!showNotifPanel)} title="Notification Center">
                🔔
                {unreadCount > 0 && <span className="notif-unread-badge">{unreadCount}</span>}
              </button>

              <div className="user-badge-chip">
                <span>{user.name.split(' ')[0]}</span>
                <span className="user-role-tag">
                  {user.role === 'DONOR' ? 'DONOR / REQUESTER' : user.role}
                </span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={logout}>Log out</button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="btn btn-outline btn-sm" onClick={() => { setAuthMode('login'); setAuthTargetPortal('user'); setPage('auth'); }}>User Login</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setAuthMode('login'); setAuthTargetPortal('hospital'); setPage('auth'); }}>🏥 Hospital Login</button>
              <button className="btn btn-primary btn-sm" onClick={() => { setAuthMode('register'); setAuthTargetPortal('user'); setPage('auth'); }}>Register</button>
            </div>
          )}
        </div>

        {/* Notifications Popover */}
        {showNotifPanel && user && (
          <div className="notif-dropdown-panel">
            <div className="notif-panel-header">
              <h4>Notifications {unreadCount > 0 ? `(${unreadCount} unread)` : ''}</h4>
              {unreadCount > 0 && (
                <button className="btn btn-outline btn-sm" onClick={markAllRead}>Mark all read</button>
              )}
            </div>
            <div className="notif-items-list">
              {notifications.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No notifications yet. You're all caught up!
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={`notif-single-item ${!n.isRead ? 'unread' : ''}`}
                    onClick={() => markSingleRead(n.id)}
                  >
                    <b>{n.title}</b>
                    <p>{n.message}</p>
                    <small>{new Date(n.createdAt).toLocaleString()}</small>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </header>

      {/* Floating Toast Notification */}
      {toast.message && (
        <div className={`toast-notice ${toast.type}`}>
          <span>{toast.message}</span>
          <button className="toast-close-btn" onClick={() => setToast({ message: '', type: 'info' })}>×</button>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="main-content">

        {/* ========================================================================= */}
        {/* PAGE: HOME LANDING                                                        */}
        {/* ========================================================================= */}
        {page === 'home' && (
          <>
            <section className="hero-wrapper">
              <div>
                <div className="hero-tagline">❤️ EVERY DROP MATTERS · EMERGENCY READY</div>
                <h1 className="hero-title">
                  Connecting Lifesavers, <span>Saving Lives.</span>
                </h1>
                <p className="hero-description">
                  A smart blood donor matching and hospital emergency coordination platform. Register as a volunteer donor, manage urgent blood supply needs, and verify credentials via digital QR passes.
                </p>
                <div className="hero-cta-buttons">
                  <button className="btn btn-primary" onClick={() => { setAuthMode('register'); setPage('auth') }}>
                    Become a Donor →
                  </button>
                  <button className="btn btn-outline" onClick={() => setPage('search')}>
                    Find Compatible Donors
                  </button>
                  <button className="btn btn-secondary" onClick={() => {
                    if (user && user.role !== 'HOSPITAL') {
                      flash('You are currently signed in as a User. Please log out first to access the Hospital Portal.', 'warning');
                      return;
                    }
                    setAuthMode('login');
                    setAuthTargetPortal('hospital');
                    setPage('auth');
                  }}>
                    🏥 Hospital Portal
                  </button>
                </div>

                <div style={{
                  marginTop: '1.5rem',
                  background: 'var(--card-bg, #ffffff)',
                  border: '1.5px solid rgba(220, 38, 38, 0.25)',
                  borderRadius: '16px',
                  padding: '1.25rem 1.5rem',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '1.3rem' }}>📍</span>
                    <div>
                      <b style={{ color: 'var(--navy)', fontSize: '1.05rem', display: 'block' }}>Search Compatible Donors in Your Area</b>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enter your city or area to find verified available donors nearby with exact location filtering</span>
                    </div>
                  </div>
                  <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Blood Group</label>
                      <select
                        value={searchFilter.bloodGroup}
                        onChange={e => setSearchFilter({ ...searchFilter, bloodGroup: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: '#fff', fontSize: '0.88rem' }}
                      >
                        <option value="">Any Compatible Blood Group</option>
                        {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Your Area / City / Location</label>
                      <input
                        placeholder="e.g. Hyderabad, Banjara Hills..."
                        value={searchFilter.location}
                        onChange={e => setSearchFilter({ ...searchFilter, location: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: '#fff', fontSize: '0.88rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Component</label>
                      <select
                        value={searchFilter.component}
                        onChange={e => setSearchFilter({ ...searchFilter, component: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: '#fff', fontSize: '0.88rem' }}
                      >
                        {COMPONENTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ padding: '9px 16px', fontWeight: 600, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      🔍 Find in My Area
                    </button>
                  </form>
                </div>
                <div className="hero-stats-row">
                  <div className="hero-stat-item">
                    <b>8</b>
                    <span>ABO/Rh Blood Types</span>
                  </div>
                  <div className="hero-stat-item">
                    <b>100%</b>
                    <span>Consent Governed</span>
                  </div>
                  <div className="hero-stat-item">
                    <b>4 Components</b>
                    <span>Whole Blood, RBC, Plasma, Platelets</span>
                  </div>
                </div>
              </div>

              <div className="hero-art-container">
                <div className="hero-visual-card">
                  <div className="hero-blood-drop-badge">
                    <span>✚</span>
                  </div>
                  <div className="hero-card-headline">LifeLink Clinical Match</div>
                  <p className="hero-card-sub">Component-aware matching engine for true clinical blood and plasma compatibility.</p>
                  <div className="hero-feature-tags">
                    <div className="hero-feature-tag-item"><span>✓</span> Red Cell & Inverted Plasma Compatibility Engine</div>
                    <div className="hero-feature-tag-item"><span>✓</span> Single-Use QR Verifiable Digital Donor Passes</div>
                    <div className="hero-feature-tag-item"><span>✓</span> Hospital Duplicate Request Protection</div>
                    <div className="hero-feature-tag-item"><span>✓</span> Cooldown Intervals & Donation Reminders</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Feature Highlights Grid */}
            <section className="features-section">
              <div className="section-header-center">
                <span className="section-pill-tag">ENGINEERED FOR CLINICAL REALITY</span>
                <h2 className="section-main-heading">Clinical Coordination Architecture</h2>
                <p className="section-subtext">Designed to prevent record duplication, safeguard donor confidentiality, and respect safe donation intervals.</p>
              </div>

              <div className="features-cards-grid">
                <div className="feature-box">
                  <div className="feature-box-icon">🎯</div>
                  <h3>Smart Donor Matching</h3>
                  <p>Evaluates blood compatibility, distance, availability, and safe donation recovery periods with transparent reasoning.</p>
                </div>
                <div className="feature-box">
                  <div className="feature-box-icon">🚨</div>
                  <h3>Emergency Prioritization</h3>
                  <p>NORMAL, URGENT, and CRITICAL blood requests with anti-abuse rate limits and immediate notifications to compatible donors.</p>
                </div>
                <div className="feature-box">
                  <div className="feature-box-icon">🛡️</div>
                  <h3>Privacy-First Consent</h3>
                  <p>Phone numbers and emails are never exposed in public searches. Donors retain full control over discovery.</p>
                </div>
                <div className="feature-box">
                  <div className="feature-box-icon">📱</div>
                  <h3>Digital QR Donor Pass</h3>
                  <p>Tamper-resistant digital donor pass with cryptographically secure single-use verification tokens and instant token revocation.</p>
                </div>
                <div className="feature-box">
                  <div className="feature-box-icon">📋</div>
                  <h3>Duplicate Request Guard</h3>
                  <p>Detects overlapping requests from the same hospital to avoid staff confusion and prevents donation record duplication.</p>
                </div>
                <div className="feature-box">
                  <div className="feature-box-icon">📊</div>
                  <h3>Audit & Analytics Trail</h3>
                  <p>Traceability of all system actions, login events, and request transitions with authorized CSV reporting.</p>
                </div>
              </div>

              {/* Component Compatibility Matrix */}
              <div className="matrix-container">
                <div className="matrix-header">
                  <h3>Clinical Blood Component Compatibility Matrix</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                    Note: Red blood cell (RBC) compatibility differs from Plasma. O- is the universal red-cell donor, while AB+ is the universal plasma donor.
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th>Blood Group</th>
                        <th>Can Donate Red Cells (RBC) To</th>
                        <th>Can Receive Red Cells From</th>
                        <th>Can Donate Plasma To</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td><span className="blood-pill">O-</span></td><td>All Blood Groups (Universal Donor)</td><td>O- only</td><td>O only</td></tr>
                      <tr><td><span className="blood-pill">O+</span></td><td>O+, A+, B+, AB+</td><td>O+, O-</td><td>O only</td></tr>
                      <tr><td><span className="blood-pill">A-</span></td><td>A-, A+, AB-, AB+</td><td>A-, O-</td><td>A, O</td></tr>
                      <tr><td><span className="blood-pill">A+</span></td><td>A+, AB+</td><td>A+, A-, O+, O-</td><td>A, O</td></tr>
                      <tr><td><span className="blood-pill">B-</span></td><td>B-, B+, AB-, AB+</td><td>B-, O-</td><td>B, O</td></tr>
                      <tr><td><span className="blood-pill">B+</span></td><td>B+, AB+</td><td>B+, B-, O+, O-</td><td>B, O</td></tr>
                      <tr><td><span className="blood-pill">AB-</span></td><td>AB-, AB+</td><td>AB-, A-, B-, O-</td><td>All Blood Groups (Universal Plasma)</td></tr>
                      <tr><td><span className="blood-pill">AB+</span></td><td>AB+ only</td><td>All Blood Groups (Universal Recipient)</td><td>All Blood Groups (Universal Plasma)</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ========================================================================= */}
        {/* PAGE: SEARCH DONORS                                                       */}
        {/* ========================================================================= */}
        {page === 'search' && (
          <section>
            <div className="card-panel">
              <div className="card-panel-header">
                <div>
                  <h2>Smart Donor Directory</h2>
                  <p>Discover available donors with compatibility analysis, location matching, and privacy protection.</p>
                </div>
              </div>

              <form onSubmit={handleSearch} className="form-row-3" style={{ alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Blood Group Required</label>
                  <select
                    value={searchFilter.bloodGroup}
                    onChange={e => setSearchFilter({ ...searchFilter, bloodGroup: e.target.value })}
                  >
                    <option value="">Any Compatible Blood Group</option>
                    {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Donation Component</label>
                  <select
                    value={searchFilter.component}
                    onChange={e => setSearchFilter({ ...searchFilter, component: e.target.value })}
                  >
                    {COMPONENTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>City / Location</label>
                  <input
                    placeholder="e.g. Hyderabad, Secunderabad"
                    value={searchFilter.location}
                    onChange={e => setSearchFilter({ ...searchFilter, location: e.target.value })}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" disabled={loading}>
                    {loading ? 'Searching…' : 'Search Compatible Donors →'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => { setSearchFilter({ bloodGroup: '', location: '', component: 'WHOLE_BLOOD' }); handleSearch(); }}>
                    Reset Filters
                  </button>
                </div>
              </form>

              {loading && (
                <div>
                  <div className="skeleton-row" />
                  <div className="skeleton-row" />
                  <div className="skeleton-row" />
                </div>
              )}

              {!loading && searchSearched && searchResults.length === 0 && (
                <div className="empty-state-card">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-title">No Matching Donors Found</div>
                  <p className="empty-state-desc">No active discoverable donors matched this blood group and location. Try searching for all locations or another component.</p>
                  <button className="btn btn-outline btn-sm" onClick={() => { setSearchFilter({ bloodGroup: '', location: '', component: 'WHOLE_BLOOD' }); handleSearch(); }}>
                    View All Donors
                  </button>
                </div>
              )}

              {!loading && searchResults.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ fontSize: '1rem', color: 'var(--navy)', margin: 0 }}>
                        Matching Candidates ({searchResults.length})
                      </h3>
                      {searchFilter.location && (
                        <span style={{ fontSize: '0.8rem', padding: '3px 10px', borderRadius: '12px', background: 'rgba(220, 38, 38, 0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                          📍 Accurate Area Filter: "{searchFilter.location}"
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Privacy Protected: Private numbers & emails hidden
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {searchResults.map(d => (
                      <div key={d.id} className="card-panel" style={{ padding: '1.25rem', marginBottom: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <b style={{ fontSize: '1rem', color: 'var(--navy)' }}>{d.displayName}</b>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>📍 {d.city}</div>
                          </div>
                          <span className="blood-pill">{d.bloodGroup}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: 'var(--success-bg)', color: 'var(--success)' }}>
                            Score: {d.matchScore} pts
                          </span>
                          {d.cooldownMet ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>✓ Cooldown Met</span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>⚠️ Recent Donation</span>
                          )}
                        </div>

                        <div style={{ background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                          <b>Matching Reasons:</b>
                          <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
                            {d.reasons.map((r, i) => <li key={i}>{r}</li>)}
                          </ul>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '8px', fontSize: '0.72rem', color: 'var(--text-light)' }}>
                          🔒 Direct contact requires authorized hospital workflow verification.
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* PAGE: DIGITAL QR CARD VERIFICATION                                       */}
        {/* ========================================================================= */}
        {page === 'verify' && (
          <section style={{ maxWidth: '650px', margin: '0 auto' }}>
            <div className="card-panel">
              <div className="card-panel-header">
                <div>
                  <h2>Digital Donor Pass Verification</h2>
                  <p>Cryptographic token verification for registered volunteer passes.</p>
                </div>
              </div>

              <div className="form-group">
                <label>Verification Token / User Verification Code</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    placeholder="Enter or paste QR token or User Code (e.g. V-123456)"
                    value={verifyTokenInput}
                    onChange={e => setVerifyTokenInput(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={() => handleVerify()}>Verify Card</button>
                </div>
              </div>

              {verifyResult && (
                <div style={{
                  marginTop: '1.5rem',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: `1px solid ${verifyResult.valid ? 'var(--success)' : 'var(--danger)'}`,
                  background: verifyResult.valid ? 'var(--success-bg)' : 'var(--danger-bg)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '1.8rem' }}>{verifyResult.valid ? '✅' : '❌'}</span>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', color: verifyResult.valid ? 'var(--success)' : 'var(--danger)' }}>
                        {verifyResult.valid ? 'Active Verified Donor Card' : 'Invalid or Revoked Pass'}
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: {verifyResult.verificationStatus}</div>
                    </div>
                  </div>

                  {verifyResult.valid && (
                    <div style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--navy)' }}>
                      <p><b>Donor Name:</b> {verifyResult.donorName}</p>
                      <p><b>Recorded Blood Group:</b> <span className="blood-pill">{verifyResult.bloodGroup}</span></p>
                      <p><b>Member Since:</b> {verifyResult.memberSince}</p>
                      {verifyResult.verificationCode && (
                        <p style={{ marginTop: '6px' }}>
                          <b>Verification Code:</b>{' '}
                          <code style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--crimson)',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            {verifyResult.verificationCode}
                          </code>
                        </p>
                      )}
                    </div>
                  )}

                  <div style={{
                    marginTop: '14px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border-light)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                  }}>
                    {verifyResult.notice}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* PAGE: PRIVACY & GUIDANCE                                                  */}
        {/* ========================================================================= */}
        {page === 'privacy' && (
          <section style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card-panel">
              <div className="card-panel-header">
                <div>
                  <h2>Donor Privacy, Consent & Medical Disclaimers</h2>
                  <p>Our commitment to personal data protection and ethical health guidelines.</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: '1.7' }}>
                <div>
                  <h3 style={{ color: 'var(--navy)', marginBottom: '4px' }}>1. Explicit & Revocable Consent</h3>
                  <p>Donors have total control over whether their profile appears in search results. You can pause or revoke discovery at any time directly from your dashboard.</p>
                </div>

                <div>
                  <h3 style={{ color: 'var(--navy)', marginBottom: '4px' }}>2. Data Minimization & Security</h3>
                  <p>We never expose phone numbers, full street addresses, or email addresses in public searches. Digital donor QR codes contain only opaque tokens and no personal secrets or passwords.</p>
                </div>

                <div>
                  <h3 style={{ color: 'var(--navy)', marginBottom: '4px' }}>3. Medical Non-Liability Advisory</h3>
                  <p>LifeDrop is a communications platform. A match does NOT constitute medical clearance or eligibility. Physical donation eligibility (hemoglobin, weight, blood pressure, cooldown) must be confirmed by certified healthcare practitioners before any draw.</p>
                </div>

                <div>
                  <h3 style={{ color: 'var(--navy)', marginBottom: '4px' }}>4. Emergency Blood Needs</h3>
                  <p>If you or someone in your care is experiencing a life-threatening medical emergency, call 108 / 911 immediately or visit the nearest emergency trauma center.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* PAGE: AUTHENTICATION - 100% SEPARATE USER PORTAL & HOSPITAL PORTAL        */}
        {/* ========================================================================= */}

        {/* 1. DEDICATED HOSPITAL PORTAL (Only hospital@apollo.org - Zero user login shown) */}
        {page === 'auth' && authTargetPortal === 'hospital' && (
          <section style={{ maxWidth: '440px', margin: '0 auto' }}>
            <div className="card-panel" style={{ borderTop: '4px solid var(--primary)' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(220, 38, 38, 0.1)',
                  color: 'var(--primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  marginBottom: '10px'
                }}>
                  🏥
                </div>
                <h2 style={{ fontSize: '1.35rem', color: 'var(--navy)', marginBottom: '4px' }}>Hospital Portal Login</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Clinical staff authorization gateway for Apollo City Hospital
                </p>
              </div>

              <div style={{
                background: 'rgba(220, 38, 38, 0.06)',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '1.25rem',
                fontSize: '0.82rem',
                color: 'var(--navy)'
              }}>
                <b style={{ color: 'var(--primary)' }}>🔒 Verified Hospital Email Access:</b>
                <div style={{ marginTop: '2px', color: 'var(--text-muted)' }}>
                  Only the designated hospital email <b>hospital@apollo.org</b> is verified. Personal user accounts cannot access this portal.
                </div>
              </div>

              <form onSubmit={handleAuthSubmit}>
                <div className="form-group">
                  <label>Hospital Email</label>
                  <input
                    type="email"
                    required
                    placeholder="hospital@apollo.org"
                    value={authForm.email}
                    onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Hospital Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter hospital password"
                    value={authForm.password}
                    onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                  />
                </div>

                <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', fontWeight: 700 }} disabled={loading}>
                  {loading ? 'Verifying Hospital Credentials…' : 'Sign In to Hospital Portal →'}
                </button>
              </form>

              <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
                  onClick={() => setPage('home')}
                >
                  ← Return to Home
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 2. DEDICATED USER PORTAL (Donors & Requesters - Zero hospital portal shown) */}
        {page === 'auth' && authTargetPortal !== 'hospital' && (
          <section style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div className="card-panel">
              <div className="card-panel-header">
                <div>
                  <h2>
                    {authMode === 'login' && 'Sign In to User Portal'}
                    {authMode === 'register' && 'Create Your User Account'}
                    {authMode === 'forgot' && 'Reset Password'}
                    {authMode === 'reset' && 'Set New Password'}
                  </h2>
                  <p>
                    {authMode === 'login' && 'One single email gives you unified access to both Donor and Requester portals.'}
                    {authMode === 'register' && 'Join our volunteer network to request blood or save lives as a donor.'}
                    {authMode === 'forgot' && 'Enter your registered email address.'}
                    {authMode === 'reset' && 'Create a new secure password.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleAuthSubmit}>
                {authMode === 'register' && (
                  <>
                    <div className="form-group">
                      <label>Full Name</label>
                      <input
                        required
                        placeholder="e.g. Ramesh Kumar"
                        value={authForm.name}
                        onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Account Type</label>
                      <input
                        disabled
                        value="Unified Account (Single Login for both Donor & Requester Portals)"
                        style={{ background: 'var(--bg-surface)', color: 'var(--navy)', fontWeight: 600, fontSize: '0.88rem' }}
                      />
                      <div style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        ✓ Use your personal email to easily switch between Donor Mode and Requester Mode at any time.
                      </div>
                    </div>
                  </>
                )}

                {(authMode === 'login' || authMode === 'register' || authMode === 'forgot') && (
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={authForm.email}
                      onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                    />
                  </div>
                )}

                {(authMode === 'login' || authMode === 'register') && (
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="At least 8 characters"
                      value={authForm.password}
                      onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                    />
                  </div>
                )}

                {authMode === 'reset' && (
                  <>
                    <div className="form-group">
                      <label>Reset Token</label>
                      <input
                        required
                        value={resetToken}
                        onChange={e => setResetToken(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>New Password</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="At least 8 characters"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {authMode === 'register' && (
                  <>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Phone Number</label>
                        <input
                          placeholder="Contact phone"
                          value={authForm.phone}
                          onChange={e => setAuthForm({ ...authForm, phone: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>City</label>
                        <input
                          required
                          placeholder="e.g. Hyderabad"
                          value={authForm.city}
                          onChange={e => setAuthForm({ ...authForm, city: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Blood Group</label>
                      <select
                        value={authForm.bloodGroup}
                        onChange={e => setAuthForm({ ...authForm, bloodGroup: e.target.value })}
                      >
                        {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
                  {loading ? 'Please wait…' : (
                    authMode === 'login' ? 'Sign In →' :
                    authMode === 'register' ? 'Complete Registration →' :
                    authMode === 'forgot' ? 'Send Recovery Instructions →' :
                    'Update Password →'
                  )}
                </button>
              </form>

              <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {authMode === 'login' && (
                  <>
                    <span>Don't have an account? </span>
                    <button style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }}
                            onClick={() => { setAuthMode('register'); setAuthForm(prev => ({ ...prev, role: 'DONOR' })); }}>
                      Register here
                    </button>
                    <div style={{ marginTop: '8px' }}>
                      <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => setAuthMode('forgot')}>
                        Forgot password?
                      </button>
                    </div>
                  </>
                )}
                {authMode === 'register' && (
                  <>
                    <span>Already registered? </span>
                    <button style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }}
                            onClick={() => setAuthMode('login')}>
                      Log in here
                    </button>
                  </>
                )}
                {(authMode === 'forgot' || authMode === 'reset') && (
                  <button style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }}
                          onClick={() => setAuthMode('login')}>
                    Back to Log In
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* PAGE: DASHBOARD (DONOR, HOSPITAL, ADMIN)                                  */}
        {/* ========================================================================= */}
        {page === 'dashboard' && user && (
          <div className={`dashboard-layout ${sidebarCollapsed ? 'collapsed-sidebar' : ''}`}>
            {/* Collapsible Sidebar */}
            <aside className="dashboard-sidebar">
              <button
                className="sidebar-toggle-btn"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                {sidebarCollapsed ? '⇥' : '⇤ Collapse'}
              </button>

              {user.role === 'DONOR' && (
                <>
                  <div className="portal-mode-toggle" style={{ margin: '4px 2px 14px', padding: '4px', background: 'var(--bg-surface)', borderRadius: '10px', display: 'flex', gap: '4px' }}>
                    <button
                      className={`portal-mode-btn ${userPortalMode === 'donor' ? 'active-donor' : ''}`}
                      onClick={() => { setUserPortalMode('donor'); setActiveTab('card'); }}
                      type="button"
                    >
                      🩸 Donor Portal
                    </button>
                    <button
                      className={`portal-mode-btn ${userPortalMode === 'requester' ? 'active-requester' : ''}`}
                      onClick={() => { setUserPortalMode('requester'); setActiveTab('requester-my-requests'); }}
                      type="button"
                    >
                      📋 Requester Portal
                    </button>
                  </div>

                  {userPortalMode === 'donor' ? (
                    <>
                      <button className={`sidebar-tab-btn ${activeTab === 'card' || activeTab === 'overview' ? 'active' : ''}`}
                              onClick={() => setActiveTab('card')} title="Digital Pass">
                        💳 <span>Digital Pass</span>
                      </button>
                      <button className={`sidebar-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                              onClick={() => setActiveTab('requests')} title="Matched Requests">
                        🚨 <span>Hospital Requests ({matchedRequests.length})</span>
                      </button>
                      <button className={`sidebar-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                              onClick={() => setActiveTab('history')} title="Donation History">
                        📜 <span>History & Tracker</span>
                      </button>
                      <button className={`sidebar-tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
                              onClick={() => setActiveTab('privacy')} title="Privacy & Consent">
                        🛡️ <span>Privacy & Consent</span>
                      </button>
                      <button className={`sidebar-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                              onClick={() => setActiveTab('profile')} title="Profile">
                        👤 <span>Profile Details</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button className={`sidebar-tab-btn ${activeTab === 'requester-my-requests' || activeTab === 'overview' ? 'active' : ''}`}
                              onClick={() => setActiveTab('requester-my-requests')} title="My Requests">
                        📋 <span>My Blood Requests ({myRequesterRequests.length})</span>
                      </button>
                      <button className={`sidebar-tab-btn ${activeTab === 'requester-create' ? 'active' : ''}`}
                              onClick={() => setActiveTab('requester-create')} title="Request Blood">
                        ➕ <span>Request Blood (Send to Hospital)</span>
                      </button>
                      <button className={`sidebar-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                              onClick={() => setActiveTab('profile')} title="Profile">
                        👤 <span>Profile & Verification</span>
                      </button>
                    </>
                  )}
                </>
              )}

              {user.role === 'HOSPITAL' && (
                <>
                  <button className={`sidebar-tab-btn ${activeTab === 'mediation' || activeTab === 'overview' ? 'active' : ''}`}
                          onClick={() => setActiveTab('mediation')} title="Patient Mediation">
                    🤝 <span>Patient Demands & Mediation ({mediationRequests.length})</span>
                  </button>
                  <button className={`sidebar-tab-btn ${activeTab === 'donors' ? 'active' : ''}`}
                          onClick={() => { setActiveTab('donors'); fetchHospitalDonors(); }} title="Manage Donors">
                    👥 <span>Registered Donors ({hospitalDonors.length})</span>
                  </button>
                  <button className={`sidebar-tab-btn ${activeTab === 'hospital-records' ? 'active' : ''}`}
                          onClick={() => { setActiveTab('hospital-records'); fetchHospitalRecords(); }} title="Hospital Records">
                    📜 <span>Hospital Records ({hospitalDonations.length + hospitalFulfilledRequests.length})</span>
                  </button>
                  <button className={`sidebar-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                          onClick={() => setActiveTab('requests')} title="Requests">
                    📋 <span>Hospital Requests ({hospitalRequests.length})</span>
                  </button>
                  <button className={`sidebar-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
                          onClick={() => setActiveTab('create')} title="New Request">
                    ➕ <span>Create Request</span>
                  </button>
                  <button className={`sidebar-tab-btn ${activeTab === 'matching' ? 'active' : ''}`}
                          onClick={() => setActiveTab('matching')} title="Smart Match">
                    🎯 <span>Smart Matches</span>
                  </button>
                  <button className={`sidebar-tab-btn ${activeTab === 'confirm' ? 'active' : ''}`}
                          onClick={() => setActiveTab('confirm')} title="Confirm Donation">
                    ✅ <span>Confirm Donation</span>
                  </button>
                </>
              )}

              {user.role === 'ADMIN' && (
                <>
                  <button className={`sidebar-tab-btn ${activeTab === 'analytics' || activeTab === 'overview' ? 'active' : ''}`}
                          onClick={() => setActiveTab('analytics')} title="Analytics">
                    📊 <span>Analytics Dashboard</span>
                  </button>
                  <button className={`sidebar-tab-btn ${activeTab === 'moderation' ? 'active' : ''}`}
                          onClick={() => setActiveTab('moderation')} title="Moderation">
                    📋 <span>Requests ({adminRequests.length})</span>
                  </button>
                  <button className={`sidebar-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                          onClick={() => setActiveTab('users')} title="User Accounts">
                    👥 <span>User Accounts ({adminUsers.length})</span>
                  </button>
                  <button className={`sidebar-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
                          onClick={() => setActiveTab('audit')} title="Audit Logs">
                    🔒 <span>Security Audit Logs</span>
                  </button>
                </>
              )}
            </aside>

            {/* Dashboard Main Area */}
            <div className="dashboard-content-area">

              {/* ------------------------------------------------------------- */}
              {/* REQUESTER: MY BLOOD REQUESTS TAB                              */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'DONOR' && userPortalMode === 'requester' && (activeTab === 'requester-my-requests' || activeTab === 'overview') && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>My Blood Requests & Mediation Status</h2>
                      <p>All requests are securely routed to Apollo City Hospital as your mediator. Donor identities are protected until confirmed.</p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('requester-create')}>
                      + Request Blood
                    </button>
                  </div>

                  <div className="mediator-banner">
                    <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                    <div>
                      <b>Secured Hospital Mediation Guarantee:</b>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Apollo City Hospital acts as your secured intermediary. When you submit a request, the hospital searches matching donors, contacts them, and only reveals the donor's contact details once the donor has accepted and the hospital transmits the Available Alert.
                      </p>
                    </div>
                  </div>

                  {myRequesterRequests.length === 0 ? (
                    <div className="empty-state-card">
                      <div className="empty-state-icon">📋</div>
                      <div className="empty-state-title">No Blood Requests Submitted Yet</div>
                      <p className="empty-state-desc">Need blood for a patient? Click below to submit your requirement directly to Apollo City Hospital.</p>
                      <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('requester-create')}>
                        Create Blood Request
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {myRequesterRequests.map(r => (
                        <div key={r.id} style={{
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '1.25rem',
                          background: r.status === 'NOT_AVAILABLE' ? 'var(--danger-bg)' : (r.donorDetailsRevealed ? 'var(--success-bg)' : 'var(--bg-card)')
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="blood-pill">{r.bloodGroup}</span>
                              <span className={`priority-badge ${r.priority}`}>{r.priority}</span>
                              <span className={`status-badge ${r.status}`}>{r.status}</span>
                              <b style={{ color: 'var(--navy)' }}>Patient: {r.patientName}</b>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Req #{r.id} · {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            <div><b>Units Required:</b> {r.unitsRequired} unit(s) ({r.component?.replace('_', ' ')})</div>
                            <div><b>Location:</b> {r.city} {r.hospitalLocation ? `(${r.hospitalLocation})` : ''}</div>
                            <div><b>Mediator:</b> {r.hospitalName || 'Apollo City Hospital'}</div>
                            {r.notes && <div><b>Notes:</b> {r.notes}</div>}
                          </div>

                          {/* Live Status Callout */}
                          {r.status === 'OPEN' && (
                            <div className="status-callout-pending">
                              <span>⏳</span>
                              <div>
                                <b>Under Review by Hospital:</b> Apollo City Hospital has received your request and is currently searching for matching {r.bloodGroup} donors in the registry.
                              </div>
                            </div>
                          )}

                          {r.status === 'IN_PROGRESS' && !r.donorDetailsRevealed && (
                            <div className="status-callout-pending">
                              <span>🔍</span>
                              <div>
                                <b>Hospital Dispatched Request:</b> Apollo City Hospital has contacted candidate donor(s). Awaiting donor acceptance. Donor contact information is protected.
                              </div>
                            </div>
                          )}

                          {r.status === 'NOT_AVAILABLE' && (
                            <div className="status-callout-not-available">
                              <span>⚠️</span>
                              <div>
                                <b>Blood Not Available Alert:</b> Apollo City Hospital searched the registered donor network but unfortunately no matching {r.bloodGroup} donors are available right now. Hospital staff will continue monitoring.
                              </div>
                            </div>
                          )}

                          {/* Secured Donor Details Reveal */}
                          {!r.donorDetailsRevealed ? (
                            <div style={{
                              marginTop: '12px',
                              background: 'var(--bg-surface)',
                              border: '1px dashed var(--border)',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              fontSize: '0.82rem',
                              color: 'var(--text-muted)'
                            }}>
                              <span style={{ fontSize: '1.2rem' }}>🔒</span>
                              <div>
                                <b>Secured Mediator Protection Active</b>
                                <p style={{ margin: 0 }}>
                                  Donor details are confidential. Once the donor accepts and the hospital confirms availability, the donor's contact details will be automatically unlocked here.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="donor-unlocked-card">
                              <div className="donor-unlocked-title">
                                <b style={{ color: 'var(--success)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>🎉</span> Available Alert: Verified Donor Details
                                </b>
                                <span className="blood-pill">{r.donorBloodGroup}</span>
                              </div>
                              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                Great news! Apollo City Hospital has confirmed this donor is available for your patient. Please contact the donor to coordinate blood donation arrival at the hospital.
                              </p>
                              {r.hospitalAlertMessage && (
                                <div style={{
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  border: '1px solid #3b82f6',
                                  borderRadius: '8px',
                                  padding: '10px 14px',
                                  marginBottom: '10px',
                                  fontSize: '0.85rem',
                                  color: 'var(--navy)'
                                }}>
                                  <b>🏥 Hospital Message:</b>
                                  <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-line' }}>{r.hospitalAlertMessage}</p>
                                </div>
                              )}
                              <div className="donor-contact-grid">
                                <div className="donor-contact-item">
                                  <small>Donor Name</small>
                                  <b>{r.donorName}</b>
                                </div>
                                <div className="donor-contact-item">
                                  <small>Blood Group</small>
                                  <b style={{ color: 'var(--primary)' }}>{r.donorBloodGroup}</b>
                                </div>
                                <div className="donor-contact-item">
                                  <small>Phone Number</small>
                                  <b>{r.donorPhone || 'Contact Hospital'}</b>
                                </div>
                                <div className="donor-contact-item">
                                  <small>Email</small>
                                  <b>{r.donorEmail || 'N/A'}</b>
                                </div>
                                <div className="donor-contact-item">
                                  <small>Location / City</small>
                                  <b>{r.donorCity || 'Local Area'}</b>
                                </div>
                              </div>
                              {r.donorPhone && (
                                <div style={{ marginTop: '12px' }}>
                                  <a href={`tel:${r.donorPhone}`} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    📞 Call Donor Directly ({r.donorPhone})
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleViewTimeline(r.id)}>
                              ⏱️ View Lifecycle Timeline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* REQUESTER: CREATE BLOOD REQUEST TAB                           */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'DONOR' && userPortalMode === 'requester' && activeTab === 'requester-create' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Request Blood (Send to Hospital Mediator)</h2>
                      <p>Your request will be dispatched directly to Apollo City Hospital. The hospital will search and coordinate with donors.</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateRequesterRequest}>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Patient Full Name *</label>
                        <input
                          required
                          placeholder="e.g. Anand Rao"
                          value={requesterForm.patientName}
                          onChange={e => setRequesterForm({ ...requesterForm, patientName: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Requester Contact Phone *</label>
                        <input
                          required
                          placeholder="Contact phone for hospital updates"
                          value={requesterForm.requesterPhone}
                          onChange={e => setRequesterForm({ ...requesterForm, requesterPhone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-row-3">
                      <div className="form-group">
                        <label>Blood Group Needed *</label>
                        <select
                          value={requesterForm.bloodGroup}
                          onChange={e => setRequesterForm({ ...requesterForm, bloodGroup: e.target.value })}
                        >
                          {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Donation Component *</label>
                        <select
                          value={requesterForm.component}
                          onChange={e => setRequesterForm({ ...requesterForm, component: e.target.value })}
                        >
                          {COMPONENTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Units Required *</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          required
                          value={requesterForm.unitsRequired}
                          onChange={e => setRequesterForm({ ...requesterForm, unitsRequired: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-row-2">
                      <div className="form-group">
                        <label>City / Location *</label>
                        <input
                          required
                          placeholder="e.g. Hyderabad"
                          value={requesterForm.city}
                          onChange={e => setRequesterForm({ ...requesterForm, city: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Hospital / Clinic Name</label>
                        <input
                          placeholder="e.g. Apollo Jubilee Hills"
                          value={requesterForm.hospitalLocation}
                          onChange={e => setRequesterForm({ ...requesterForm, hospitalLocation: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Clinical Priority *</label>
                        <select
                          value={requesterForm.priority}
                          onChange={e => setRequesterForm({ ...requesterForm, priority: e.target.value })}
                        >
                          <option value="NORMAL">Normal / Scheduled</option>
                          <option value="URGENT">Urgent (Within 24 Hours)</option>
                          <option value="CRITICAL">Critical Emergency (Immediate)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Required Date *</label>
                        <input
                          type="date"
                          required
                          value={requesterForm.requiredDate}
                          onChange={e => setRequesterForm({ ...requesterForm, requiredDate: e.target.value })}
                        />
                      </div>
                    </div>

                    {requesterForm.priority !== 'NORMAL' && (
                      <div className="form-group">
                        <label>Emergency Reason / Clinical Details</label>
                        <input
                          placeholder="e.g. Emergency surgery scheduled, trauma care"
                          value={requesterForm.emergencyReason}
                          onChange={e => setRequesterForm({ ...requesterForm, emergencyReason: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label>Additional Notes / Instructions</label>
                      <textarea
                        rows={2}
                        placeholder="Any additional details or medical notes for Apollo City Hospital"
                        value={requesterForm.notes}
                        onChange={e => setRequesterForm({ ...requesterForm, notes: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                      <button className="btn btn-primary" disabled={loading}>
                        {loading ? 'Submitting to Hospital…' : 'Submit Request to Hospital Mediator →'}
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => setActiveTab('requester-my-requests')}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* DONOR: DIGITAL CARD TAB                                        */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'DONOR' && userPortalMode === 'donor' && (activeTab === 'card' || activeTab === 'overview') && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Your Digital Donor Pass</h2>
                      <p>Show this verifiable pass at registered clinics or hospital reception.</p>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={handleRegenerateQrToken}>
                      🔄 Regenerate Token
                    </button>
                  </div>

                  <div className="digital-card-preview">
                    <div className="card-chip-pattern" />
                    <div className="digital-card-topbar">
                      <div className="digital-card-brand">
                        <span>✚</span> LifeDrop Pass
                      </div>
                      <span className="digital-card-badge">VERIFIED MEMBER</span>
                    </div>

                    <div className="digital-card-body">
                      <div className="digital-qr-box">
                        {donorQrDataUrl ? (
                          <img src={donorQrDataUrl} alt="Donor Verification QR Code" />
                        ) : (
                          <span style={{ color: '#000', fontSize: '10px' }}>Loading QR…</span>
                        )}
                      </div>

                      <div className="digital-donor-details">
                        <h4>{donorCard?.donorName || user.name}</h4>
                        <div className="digital-donor-meta">ID: #{donorCard?.donorId || user.id} · Member {donorCard?.memberSince || 2026}</div>
                        <div style={{ fontSize: '0.82rem', marginTop: '4px', opacity: 0.95 }}>
                          Code: <strong style={{ color: '#fef08a', letterSpacing: '1px', fontFamily: 'monospace' }}>{donorCard?.verificationCode || user.verificationCode || donorProfile?.verificationCode || 'V-PENDING'}</strong>
                        </div>
                        <div className="digital-blood-highlight">{donorCard?.bloodGroup || user.bloodGroup || 'O+'}</div>
                      </div>
                    </div>

                    <div className="digital-card-disclaimer">
                      {donorCard?.disclaimer || 'Non-medical certificate. Safe donation eligibility must be cleared by a healthcare practitioner.'}
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <b style={{ color: 'var(--navy)' }}>Public Discovery Status</b>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {user.available ? 'You are currently visible to hospital searches for compatible needs.' : 'You have paused incoming search discovery.'}
                      </p>
                    </div>
                    <button
                      className={`btn ${user.available ? 'btn-outline' : 'btn-primary'} btn-sm`}
                      onClick={handleToggleAvailability}
                    >
                      {user.available ? 'Pause Discovery' : 'Activate Availability'}
                    </button>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* DONOR: MATCHED REQUESTS TAB                                    */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'DONOR' && userPortalMode === 'donor' && activeTab === 'requests' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Matched Blood Requests</h2>
                      <p>Open requests from hospitals matching your blood group ({user.bloodGroup}).</p>
                    </div>
                  </div>

                  {matchedRequests.length === 0 ? (
                    <div className="empty-state-card">
                      <div className="empty-state-icon">🎉</div>
                      <div className="empty-state-title">No Urgent Requests Right Now</div>
                      <p className="empty-state-desc">There are no open blood requests currently matching your blood group in your area.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {matchedRequests.map(r => {
                        const isDeclined = r.donorResponseStatus === 'DECLINED'
                        const isAccepted = r.donorResponseStatus === 'ACCEPTED'
                        return (
                          <div key={r.id} style={{
                            border: isDeclined ? '1px solid var(--border)' : '1px solid var(--border)',
                            borderRadius: '10px',
                            padding: '1.25rem',
                            background: isDeclined
                              ? 'var(--bg-surface)'
                              : r.priority === 'CRITICAL' ? 'var(--danger-bg)' : 'var(--bg-card)',
                            opacity: isDeclined ? 0.65 : 1,
                            position: 'relative'
                          }}>
                            {isDeclined && (
                              <div style={{
                                position: 'absolute', top: '10px', right: '10px',
                                background: 'var(--danger)', color: '#fff',
                                borderRadius: '6px', padding: '3px 10px',
                                fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.03em'
                              }}>
                                ❌ DECLINED
                              </div>
                            )}
                            {isAccepted && (
                              <div style={{
                                position: 'absolute', top: '10px', right: '10px',
                                background: 'var(--success)', color: '#fff',
                                borderRadius: '6px', padding: '3px 10px',
                                fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.03em'
                              }}>
                                ✅ ACCEPTED
                              </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="blood-pill">{r.bloodGroup}</span>
                                <span className={`priority-badge ${r.priority}`}>{r.priority}</span>
                                <b style={{ color: 'var(--navy)' }}>{r.unitsRequired} unit(s) · {r.hospitalName}</b>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Required: {r.requiredDate}</span>
                            </div>

                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                              📍 {r.city} {r.hospitalLocation ? `(${r.hospitalLocation})` : ''} — {r.notes || 'Emergency replenishment requested.'}
                            </p>

                            {r.emergencyReason && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--danger)', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px' }}>
                                <b>Emergency Justification:</b> {r.emergencyReason}
                              </div>
                            )}

                            {isDeclined ? (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 14px',
                                background: 'rgba(220,38,38,0.07)',
                                border: '1px dashed var(--danger)',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                color: 'var(--danger)',
                                fontWeight: 600
                              }}>
                                ❌ You declined this request — all actions are disabled
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleDonorRespond(r.id, 'ACCEPTED')}
                                  disabled={isAccepted}
                                >
                                  ✓ I Can Donate
                                </button>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleDonorRespond(r.id, 'DECLINED')}
                                >
                                  Decline
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleViewTimeline(r.id)}>
                                  ⏱️ View Lifecycle Timeline
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* DONOR: DONATION HISTORY & TRACKER TAB                          */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'DONOR' && userPortalMode === 'donor' && activeTab === 'history' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Donation History & Recovery Tracker</h2>
                      <p>Officially confirmed donations and safe cooldown intervals.</p>
                    </div>
                  </div>

                  <div className="metric-row">
                    <div className="stat-card">
                      <div className="stat-card-title">Total Units Donated</div>
                      <div className="stat-card-value">{donationHistory.totalUnits || 0}</div>
                      <div className="stat-card-sub">Confirmed by hospital personnel</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card-title">Last Confirmed Donation</div>
                      <div className="stat-card-value" style={{ fontSize: '1.25rem' }}>
                        {donationHistory.lastDonationDate || 'None recorded'}
                      </div>
                      <div className="stat-card-sub">Recorded in official system log</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card-title">Next Safe Interval</div>
                      <div className="stat-card-value" style={{ fontSize: '1.25rem', color: 'var(--success)' }}>
                        {donationHistory.nextEligibleDate || 'Eligible Now'}
                      </div>
                      <div className="stat-card-sub">Based on 90-day whole blood guidance</div>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1rem', color: 'var(--navy)', marginBottom: '0.75rem' }}>Verified Donation Records</h3>
                  {donationHistory.donations?.length === 0 ? (
                    <div className="empty-state-card">
                      <div className="empty-state-icon">📜</div>
                      <div className="empty-state-title">No Confirmed Donations Yet</div>
                      <p className="empty-state-desc">Your donations will appear here once verified by a hospital upon completion.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="styled-table">
                        <thead>
                          <tr>
                            <th>Donation ID</th>
                            <th>Date</th>
                            <th>Component</th>
                            <th>Units</th>
                            <th>Hospital</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {donationHistory.donations.map(d => (
                            <tr key={d.id}>
                              <td>#{d.id}</td>
                              <td>{d.donationDate}</td>
                              <td>{d.component}</td>
                              <td>{d.unitsDonated} unit(s)</td>
                              <td>{d.hospitalName}</td>
                              <td><span className="status-badge FULFILLED">{d.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ marginTop: '1.5rem', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    ℹ️ {donationHistory.disclaimer}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* DONOR: PRIVACY SETTINGS TAB                                    */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'DONOR' && userPortalMode === 'donor' && activeTab === 'privacy' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Consent & Privacy Settings</h2>
                      <p>Manage how and when your information is shared.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSavePrivacy}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          style={{ marginTop: '4px', width: '18px', height: '18px' }}
                          checked={donorPrivacy.allowDiscovery}
                          onChange={e => setDonorPrivacy({ ...donorPrivacy, allowDiscovery: e.target.checked })}
                        />
                        <div>
                          <b style={{ color: 'var(--navy)', display: 'block' }}>Allow Donor Discovery</b>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Allows authorized hospital searches to match your blood group and city. Uncheck to become completely invisible to searches.
                          </span>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          style={{ marginTop: '4px', width: '18px', height: '18px' }}
                          checked={donorPrivacy.allowNotifications}
                          onChange={e => setDonorPrivacy({ ...donorPrivacy, allowNotifications: e.target.checked })}
                        />
                        <div>
                          <b style={{ color: 'var(--navy)', display: 'block' }}>Receive In-App Emergency Alerts</b>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Receive notification bell alerts when hospitals in your area urgently need your blood group.
                          </span>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          style={{ marginTop: '4px', width: '18px', height: '18px' }}
                          checked={donorPrivacy.allowEmailNotifications}
                          onChange={e => setDonorPrivacy({ ...donorPrivacy, allowEmailNotifications: e.target.checked })}
                        />
                        <div>
                          <b style={{ color: 'var(--navy)', display: 'block' }}>Opt into Email Alerts</b>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Only triggered when email service provider is active and configured in server environment.
                          </span>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          style={{ marginTop: '4px', width: '18px', height: '18px' }}
                          checked={donorPrivacy.allowSmsNotifications}
                          onChange={e => setDonorPrivacy({ ...donorPrivacy, allowSmsNotifications: e.target.checked })}
                        />
                        <div>
                          <b style={{ color: 'var(--navy)', display: 'block' }}>Opt into SMS Urgent Notifications</b>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Only sent for verified CRITICAL trauma requirements when SMS provider is configured.
                          </span>
                        </div>
                      </label>
                    </div>

                    <button className="btn btn-primary" disabled={loading}>Save Privacy Preferences</button>
                  </form>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* USER: PROFILE & VERIFICATION TAB                              */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'DONOR' && activeTab === 'profile' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>User Profile & Verification</h2>
                      <p>Keep your contact details up to date and view your personal verification code.</p>
                    </div>
                  </div>

                  {/* Random Verification Code Highlight Box */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.05) 0%, rgba(220, 38, 38, 0.05) 100%)',
                    border: '1.5px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                        <b style={{ fontSize: '1rem', color: 'var(--navy)' }}>Your Verification Code</b>
                        <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Randomly Generated</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        This random code uniquely identifies your profile. Share this code or your QR pass with clinics or hospitals for fast identity verification.
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        letterSpacing: '1.5px',
                        color: 'var(--crimson)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontFamily: 'monospace'
                      }}>
                        {donorProfile?.verificationCode || user.verificationCode || 'V-PENDING'}
                      </code>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          const code = donorProfile?.verificationCode || user.verificationCode
                          if (code) {
                            navigator.clipboard.writeText(code)
                            flash('Verification code copied to clipboard!')
                          }
                        }}
                        title="Copy Verification Code"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleSaveProfile}>
                    <div className="form-group">
                      <label>User Verification Code (Assigned to Profile)</label>
                      <input
                        readOnly
                        disabled
                        value={donorProfile?.verificationCode || user.verificationCode || ''}
                        style={{ background: 'var(--bg-muted)', cursor: 'not-allowed', fontWeight: 700, color: 'var(--crimson)', letterSpacing: '1px' }}
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Unique random verification code registered to your account.</small>
                    </div>

                    <div className="form-group">
                      <label>Full Name</label>
                      <input
                        required
                        value={donorProfile.name}
                        onChange={e => setDonorProfile({ ...donorProfile, name: e.target.value })}
                      />
                    </div>

                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Phone Number</label>
                        <input
                          value={donorProfile.phone || ''}
                          onChange={e => setDonorProfile({ ...donorProfile, phone: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>City</label>
                        <input
                          required
                          value={donorProfile.city || ''}
                          onChange={e => setDonorProfile({ ...donorProfile, city: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-row-2">
                      <div className="form-group">
                        <label>District / Area</label>
                        <input
                          placeholder="e.g. Jubilee Hills, Gachibowli"
                          value={donorProfile.district || ''}
                          onChange={e => setDonorProfile({ ...donorProfile, district: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Blood Group</label>
                        <select
                          value={donorProfile.bloodGroup}
                          onChange={e => setDonorProfile({ ...donorProfile, bloodGroup: e.target.value })}
                        >
                          {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>

                    <button className="btn btn-primary" disabled={loading}>Save Profile</button>
                  </form>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* HOSPITAL: PATIENT DEMANDS & MEDIATION TAB                     */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'HOSPITAL' && (activeTab === 'mediation' || activeTab === 'overview') && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Patient Demands & Secured Mediation</h2>
                      <p>As the secured mediator, search donors for patient requests, dispatch requests, send Not Available alerts, and release Available Alerts.</p>
                    </div>
                  </div>

                  <div className="mediator-banner">
                    <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                    <div>
                      <b>Hospital Mediator Instructions:</b>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        1. Search compatible donors for each patient request. 2. If available, click <b>"Search Specific Donors"</b> and dispatch. 3. If unavailable, click <b>"Send Not Available Alert"</b> to immediately notify the patient. 4. When the donor accepts, click <b>"Send Available Alert & Connect Requester"</b> to safely unveil the donor details to the patient.
                      </p>
                    </div>
                  </div>

                  {/* Queue filter tabs */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className={`btn btn-sm ${mediationQueueFilter === 'active' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setMediationQueueFilter('active')}
                        type="button"
                      >
                        📋 Active Demands ({mediationRequests.filter(r => !r.clearedByHospital).length})
                      </button>
                      <button
                        className={`btn btn-sm ${mediationQueueFilter === 'cleared' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setMediationQueueFilter('cleared')}
                        type="button"
                      >
                        ✅ Satisfied & Cleared ({mediationRequests.filter(r => r.clearedByHospital).length})
                      </button>
                      <button
                        className={`btn btn-sm ${mediationQueueFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setMediationQueueFilter('all')}
                        type="button"
                      >
                        📁 All Demands ({mediationRequests.length})
                      </button>
                    </div>

                    {mediationQueueFilter === 'active' && mediationRequests.some(r => !r.clearedByHospital && (r.status === 'FULFILLED' || r.donorResponseStatus === 'ACCEPTED')) && (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#10b981', color: '#fff', fontWeight: 700 }}
                        onClick={() => handleClearAllSatisfied(
                          mediationRequests.filter(r => !r.clearedByHospital && (r.status === 'FULFILLED' || r.donorResponseStatus === 'ACCEPTED')).map(r => r.id)
                        )}
                        type="button"
                      >
                        🧹 Clear All Satisfied Demands
                      </button>
                    )}
                  </div>

                  {(() => {
                    const displayed = mediationRequests.filter(r => {
                      if (mediationQueueFilter === 'active') return !r.clearedByHospital
                      if (mediationQueueFilter === 'cleared') return r.clearedByHospital
                      return true
                    })

                    if (displayed.length === 0) {
                      return (
                        <div className="empty-state-card">
                          <div className="empty-state-icon">
                            {mediationQueueFilter === 'active' ? '🤝' : (mediationQueueFilter === 'cleared' ? '🧹' : '📋')}
                          </div>
                          <div className="empty-state-title">
                            {mediationQueueFilter === 'active'
                              ? 'No Active Demands Pending Mediation'
                              : (mediationQueueFilter === 'cleared'
                                  ? 'No Cleared Requests in Archive'
                                  : 'No Requests Found')}
                          </div>
                          <p className="empty-state-desc">
                            {mediationQueueFilter === 'active'
                              ? 'All incoming patient requests have been addressed or cleared from the active queue.'
                              : 'Satisfied requests cleared from the active queue will appear here.'}
                          </p>
                        </div>
                      )
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {displayed.map(r => {
                          const isAccepted = r.donorResponseStatus === 'ACCEPTED'
                          const isDeclined = r.donorResponseStatus === 'DECLINED'
                          const isSatisfied = r.status === 'FULFILLED' || isAccepted || r.donorDetailsRevealed

                          return (
                            <div key={r.id} style={{
                              border: isSatisfied ? '2px solid var(--success)' : (r.status === 'NOT_AVAILABLE' ? '1px solid var(--danger)' : '1px solid var(--border)'),
                              borderRadius: '12px',
                              padding: '1.25rem',
                              background: isSatisfied ? 'var(--success-bg)' : (r.status === 'NOT_AVAILABLE' ? 'var(--danger-bg)' : 'var(--bg-card)'),
                              boxShadow: isSatisfied ? '0 4px 14px rgba(16, 185, 129, 0.15)' : 'none'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span className="blood-pill">{r.bloodGroup}</span>
                                  <span className={`priority-badge ${r.priority}`}>{r.priority}</span>
                                  {isSatisfied ? (
                                    <span className="status-badge" style={{ background: 'var(--success)', color: '#fff', fontWeight: 800 }}>
                                      ✅ SATISFIED
                                    </span>
                                  ) : (
                                    <span className={`status-badge ${r.status}`}>{r.status}</span>
                                  )}
                                  <b style={{ color: isSatisfied ? '#065f46' : 'var(--navy)' }}>
                                    Patient: {r.patientName || 'Emergency Patient'} · {r.unitsRequired} Unit(s)
                                  </b>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  Req #{r.id} · Required: {r.requiredDate}
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                <div><b>Requester:</b> {r.requesterName || 'Hospital Direct'} {r.requesterPhone ? `(${r.requesterPhone})` : ''}</div>
                                <div><b>City / Location:</b> {r.city} {r.hospitalLocation ? `(${r.hospitalLocation})` : ''}</div>
                                <div><b>Component:</b> {r.component?.replace('_', ' ')}</div>
                                {r.notes && <div><b>Notes:</b> {r.notes}</div>}
                              </div>

                              {/* Prominent Green Satisfied Callout with Clear Option */}
                              {isSatisfied && (
                                <div style={{
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  border: '2px solid var(--success)',
                                  borderRadius: '10px',
                                  padding: '14px 16px',
                                  marginBottom: '14px',
                                  color: '#065f46',
                                  boxShadow: '0 2px 10px rgba(16, 185, 129, 0.12)'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                                    <div>
                                      <b style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>✅</span> Request Satisfied! Donor Accepted
                                      </b>
                                      <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem' }}>
                                        Donor <b>{r.assignedDonorName}</b> ({r.bloodGroup}) has accepted this blood request. Full donor contact details have been sent to both Hospital and Requester.
                                      </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      {!r.clearedByHospital ? (
                                        <button
                                          className="btn btn-sm"
                                          style={{ background: 'var(--navy)', color: '#fff', fontWeight: 700, padding: '7px 16px', borderRadius: '6px' }}
                                          onClick={() => handleClearMediationRequest(r.id)}
                                          title="Clear request from active queue"
                                        >
                                          🧹 Clear Request from Queue
                                        </button>
                                      ) : (
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          <span style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.06)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                                            ✓ Cleared / Archived
                                          </span>
                                          <button
                                            className="btn btn-outline btn-sm"
                                            style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                                            onClick={() => handleUnclearMediationRequest(r.id)}
                                            title="Restore to active queue"
                                          >
                                            ↩️ Restore
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Verified Donor Details Box */}
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                                    gap: '8px',
                                    background: '#ffffff',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    marginTop: '8px',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    fontSize: '0.84rem'
                                  }}>
                                    <div><span style={{ color: '#64748b', fontSize: '0.76rem', display: 'block' }}>Donor Name</span><b>{r.assignedDonorName}</b></div>
                                    <div><span style={{ color: '#64748b', fontSize: '0.76rem', display: 'block' }}>Blood Group</span><b style={{ color: 'var(--primary)' }}>{r.bloodGroup}</b></div>
                                    <div><span style={{ color: '#64748b', fontSize: '0.76rem', display: 'block' }}>Contact Phone</span><b>{r.assignedDonorPhone || 'Visible to requester'}</b></div>
                                    <div><span style={{ color: '#64748b', fontSize: '0.76rem', display: 'block' }}>Email</span><b>{r.assignedDonorEmail || 'N/A'}</b></div>
                                    <div><span style={{ color: '#64748b', fontSize: '0.76rem', display: 'block' }}>City / Location</span><b>{r.assignedDonorCity || r.city || 'N/A'}</b></div>
                                  </div>
                                </div>
                              )}

                              {/* Assigned Donor Status (when not yet satisfied) */}
                              {!isSatisfied && r.assignedDonorName && (
                                <div style={{
                                  background: 'var(--bg-surface)',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  marginBottom: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}>
                                  <div>
                                    <b>Assigned Donor:</b> {r.assignedDonorName} {r.assignedDonorPhone ? `(📞 ${r.assignedDonorPhone})` : ''}
                                  </div>
                                  <div>
                                    {isDeclined && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>❌ DECLINED</span>}
                                    {!isDeclined && <span style={{ color: 'var(--warning)', fontWeight: 700 }}>⏳ REQUESTED (Awaiting Response)</span>}
                                  </div>
                                </div>
                              )}

                              {/* Mediation Actions */}
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {!isSatisfied && (
                                  <button className="btn btn-primary btn-sm" onClick={() => handleSearchMediationDonors(r)}>
                                    🔍 Search Specific {r.bloodGroup} Donors
                                  </button>
                                )}

                                {!isSatisfied && r.status !== 'NOT_AVAILABLE' && (
                                  <button
                                    className="btn btn-outline btn-sm"
                                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                    onClick={() => setNotAvailableModalReqId(r.id)}
                                  >
                                    ⚠️ Send 'Not Available' Alert
                                  </button>
                                )}

                                {!r.clearedByHospital && isSatisfied && (
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: 'var(--navy)', color: '#fff', fontWeight: 700 }}
                                    onClick={() => handleClearMediationRequest(r.id)}
                                  >
                                    🧹 Clear Request from Queue
                                  </button>
                                )}

                                {r.clearedByHospital && (
                                  <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => handleUnclearMediationRequest(r.id)}
                                  >
                                    ↩️ Restore to Active
                                  </button>
                                )}

                                <button className="btn btn-secondary btn-sm" onClick={() => handleViewTimeline(r.id)}>
                                  ⏱️ Timeline
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* HOSPITAL: REGISTERED DONOR DIRECTORY & REMOVAL TAB              */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'HOSPITAL' && activeTab === 'donors' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Registered Donors & Donor Management</h2>
                      <p>View all donors registered in the network. Hospital has access to manage and remove donor accounts.</p>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={fetchHospitalDonors}>
                      🔄 Refresh Donors
                    </button>
                  </div>

                  {hospitalDonors.length === 0 ? (
                    <div className="empty-state-card">
                      <div className="empty-state-icon">👥</div>
                      <div className="empty-state-title">No Registered Donors in Network Yet</div>
                      <p className="empty-state-desc">When users register with their own emails as donors, they will appear in this directory.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Donor Name</th>
                            <th>Email Address</th>
                            <th>Blood Group</th>
                            <th>Phone</th>
                            <th>City</th>
                            <th>Status</th>
                            <th>Registered</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hospitalDonors.map(d => (
                            <tr key={d.id}>
                              <td><b>{d.name}</b></td>
                              <td>{d.email}</td>
                              <td><span className="blood-pill">{d.bloodGroup || 'N/A'}</span></td>
                              <td>{d.phone || '—'}</td>
                              <td>{d.city || '—'}</td>
                              <td>
                                <span className={`status-badge ${d.available ? 'OPEN' : 'CANCELLED'}`}>
                                  {d.available ? 'Available' : 'Unavailable'}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="btn btn-sm"
                                  style={{ background: 'var(--danger)', color: '#fff', fontSize: '0.8rem', padding: '4px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                  onClick={() => handleRemoveDonor(d)}
                                  title="Remove Donor from Database"
                                >
                                  🗑️ Remove Donor
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* HOSPITAL: RECORDS TAB (DONATED & FULFILLED SEPARATE RECORDS)   */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'HOSPITAL' && activeTab === 'hospital-records' && (() => {
                const filteredDonations = hospitalDonations.filter(d => {
                  const q = (recordsSearchQuery || '').toLowerCase().trim();
                  const matchesSearch = !q ||
                    (d.donorName && d.donorName.toLowerCase().includes(q)) ||
                    (d.bloodGroup && d.bloodGroup.toLowerCase().includes(q)) ||
                    (d.component && d.component.toLowerCase().includes(q)) ||
                    (d.notes && d.notes.toLowerCase().includes(q)) ||
                    (d.donorEmail && d.donorEmail.toLowerCase().includes(q)) ||
                    (d.donorPhone && d.donorPhone.toLowerCase().includes(q)) ||
                    (d.id && String(d.id).includes(q));
                  const matchesBg = !recordsBloodGroupFilter || d.bloodGroup === recordsBloodGroupFilter;
                  return matchesSearch && matchesBg;
                });

                const filteredFulfilled = hospitalFulfilledRequests.filter(r => {
                  const q = (recordsSearchQuery || '').toLowerCase().trim();
                  const matchesSearch = !q ||
                    (r.patientName && r.patientName.toLowerCase().includes(q)) ||
                    (r.requesterName && r.requesterName.toLowerCase().includes(q)) ||
                    (r.requesterEmail && r.requesterEmail.toLowerCase().includes(q)) ||
                    (r.requesterPhone && r.requesterPhone.toLowerCase().includes(q)) ||
                    (r.assignedDonorName && r.assignedDonorName.toLowerCase().includes(q)) ||
                    (r.assignedDonorPhone && r.assignedDonorPhone.toLowerCase().includes(q)) ||
                    (r.assignedDonorEmail && r.assignedDonorEmail.toLowerCase().includes(q)) ||
                    (r.city && r.city.toLowerCase().includes(q)) ||
                    (r.bloodGroup && r.bloodGroup.toLowerCase().includes(q)) ||
                    (r.id && String(r.id).includes(q));
                  const matchesBg = !recordsBloodGroupFilter || r.bloodGroup === recordsBloodGroupFilter;
                  return matchesSearch && matchesBg;
                });

                const totalDonatedUnits = filteredDonations.reduce((acc, d) => acc + (d.unitsDonated || 1), 0);
                const uniqueDonorsCount = new Set(filteredDonations.map(d => d.donorId)).size;
                const totalFulfilledUnits = filteredFulfilled.reduce((acc, r) => acc + (r.unitsRequired || 1), 0);

                return (
                  <div className="card-panel">
                    <div className="card-panel-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h2>📜 Hospital Clinical Records</h2>
                        <p>Official verified records of completed blood donations and fulfilled patient demands.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-outline btn-sm" onClick={fetchHospitalRecords}>
                          🔄 Refresh Records
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                          🖨️ Print Records
                        </button>
                      </div>
                    </div>

                    {/* Sub-Tabs: Donated Records vs Request Fulfilled Records */}
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      marginBottom: '1.5rem',
                      borderBottom: '2px solid var(--border-light)',
                      paddingBottom: '8px'
                    }}>
                      <button
                        onClick={() => setRecordsSubTab('donated')}
                        style={{
                          background: recordsSubTab === 'donated' ? 'var(--primary)' : 'transparent',
                          color: recordsSubTab === 'donated' ? '#fff' : 'var(--text-muted)',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.95rem',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span>🩸 Donated Records</span>
                        <span style={{
                          background: recordsSubTab === 'donated' ? 'rgba(255,255,255,0.25)' : 'var(--border-light)',
                          color: recordsSubTab === 'donated' ? '#fff' : 'var(--navy)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.8rem'
                        }}>
                          {hospitalDonations.length}
                        </span>
                      </button>

                      <button
                        onClick={() => setRecordsSubTab('fulfilled')}
                        style={{
                          background: recordsSubTab === 'fulfilled' ? '#16a34a' : 'transparent',
                          color: recordsSubTab === 'fulfilled' ? '#fff' : 'var(--text-muted)',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.95rem',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span>✅ Request Fulfilled Records</span>
                        <span style={{
                          background: recordsSubTab === 'fulfilled' ? 'rgba(255,255,255,0.25)' : 'var(--border-light)',
                          color: recordsSubTab === 'fulfilled' ? '#fff' : 'var(--navy)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.8rem'
                        }}>
                          {hospitalFulfilledRequests.length}
                        </span>
                      </button>
                    </div>

                    {/* Stats Summary Bar */}
                    {recordsSubTab === 'donated' ? (
                      <div className="stats-row" style={{ marginBottom: '1.25rem' }}>
                        <div className="stat-card">
                          <div className="stat-card-title">Total Donated Records</div>
                          <div className="stat-card-value" style={{ color: 'var(--primary)' }}>{filteredDonations.length}</div>
                          <div className="stat-card-sub">Officially verified donations</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-card-title">Total Units Donated</div>
                          <div className="stat-card-value" style={{ color: '#16a34a' }}>{totalDonatedUnits} Units</div>
                          <div className="stat-card-sub">Whole blood & components</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-card-title">Participating Donors</div>
                          <div className="stat-card-value" style={{ color: 'var(--navy)' }}>{uniqueDonorsCount}</div>
                          <div className="stat-card-sub">Unique verified lifesavers</div>
                        </div>
                      </div>
                    ) : (
                      <div className="stats-row" style={{ marginBottom: '1.25rem' }}>
                        <div className="stat-card">
                          <div className="stat-card-title">Fulfilled Demands</div>
                          <div className="stat-card-value" style={{ color: '#16a34a' }}>{filteredFulfilled.length}</div>
                          <div className="stat-card-sub">Successfully resolved cases</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-card-title">Patient Units Supplied</div>
                          <div className="stat-card-value" style={{ color: 'var(--primary)' }}>{totalFulfilledUnits} Units</div>
                          <div className="stat-card-sub">Direct patient delivery</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-card-title">Clinical Satisfaction</div>
                          <div className="stat-card-value" style={{ color: '#16a34a' }}>100%</div>
                          <div className="stat-card-sub">Donor details unlocked</div>
                        </div>
                      </div>
                    )}

                    {/* Filter / Search Bar */}
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      flexWrap: 'wrap',
                      marginBottom: '1.25rem',
                      background: 'var(--bg-surface, #f8fafc)',
                      padding: '12px 16px',
                      borderRadius: '10px'
                    }}>
                      <div style={{ flex: '1', minWidth: '220px' }}>
                        <input
                          placeholder={recordsSubTab === 'donated' ? "🔍 Search donated records by donor, phone, email, notes..." : "🔍 Search fulfilled requests by patient, requester, donor, phone..."}
                          value={recordsSearchQuery}
                          onChange={e => setRecordsSearchQuery(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                        />
                      </div>
                      <div style={{ width: '180px' }}>
                        <select
                          value={recordsBloodGroupFilter}
                          onChange={e => setRecordsBloodGroupFilter(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
                        >
                          <option value="">All Blood Groups</option>
                          {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      {(recordsSearchQuery || recordsBloodGroupFilter) && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => { setRecordsSearchQuery(''); setRecordsBloodGroupFilter(''); }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>

                    {/* ======================================================== */}
                    {/* TAB 1: DONATED RECORDS TABLE                             */}
                    {/* ======================================================== */}
                    {recordsSubTab === 'donated' && (
                      filteredDonations.length === 0 ? (
                        <div className="empty-state-card">
                          <div className="empty-state-icon">🩸</div>
                          <div className="empty-state-title">No Donated Records Found</div>
                          <p className="empty-state-desc">
                            {recordsSearchQuery || recordsBloodGroupFilter
                              ? "No donated records matched your search filters. Try clearing filters."
                              : "When donors complete blood donations or when requests are fulfilled, verified donation records will appear here."}
                          </p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Record ID</th>
                                <th>Donor Information</th>
                                <th>Blood Group & Component</th>
                                <th>Units Donated</th>
                                <th>Donation Date</th>
                                <th>Related Request</th>
                                <th>Verification & Status</th>
                                <th>Clinical Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredDonations.map(d => (
                                <tr key={d.id} style={{ background: '#fff' }}>
                                  <td>
                                    <span style={{ fontWeight: 700, color: 'var(--navy)', fontFamily: 'monospace' }}>
                                      #D-{d.id}
                                    </span>
                                  </td>
                                  <td>
                                    <b style={{ color: 'var(--navy)', fontSize: '0.95rem' }}>{d.donorName}</b>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      📞 {d.donorPhone || 'N/A'}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                      ✉️ {d.donorEmail || 'N/A'}
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span className="blood-pill">{d.bloodGroup}</span>
                                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.component}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <b style={{ fontSize: '1rem', color: '#16a34a' }}>
                                      {d.unitsDonated} Unit(s)
                                    </b>
                                  </td>
                                  <td>
                                    <span style={{ fontWeight: 600, color: 'var(--navy)' }}>
                                      {d.donationDate}
                                    </span>
                                  </td>
                                  <td>
                                    {d.bloodRequestId ? (
                                      <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(220, 38, 38, 0.1)', color: 'var(--primary)', fontWeight: 600, fontSize: '0.82rem' }}>
                                        #REQ-{d.bloodRequestId}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Direct Clinical Donation</span>
                                    )}
                                  </td>
                                  <td>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      background: '#dcfce7',
                                      color: '#15803d',
                                      fontWeight: 700,
                                      fontSize: '0.8rem'
                                    }}>
                                      ✓ {d.status || 'CONFIRMED'}
                                    </span>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                                      by {d.hospitalName || 'Apollo City Hospital'}
                                    </div>
                                  </td>
                                  <td style={{ maxWidth: '240px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    {d.notes || 'Official blood donation confirmed & added to inventory.'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}

                    {/* ======================================================== */}
                    {/* TAB 2: REQUEST FULFILLED RECORDS TABLE                   */}
                    {/* ======================================================== */}
                    {recordsSubTab === 'fulfilled' && (
                      filteredFulfilled.length === 0 ? (
                        <div className="empty-state-card">
                          <div className="empty-state-icon">✅</div>
                          <div className="empty-state-title">No Fulfilled Requests Found</div>
                          <p className="empty-state-desc">
                            {recordsSearchQuery || recordsBloodGroupFilter
                              ? "No fulfilled requests matched your search filters. Try clearing filters."
                              : "When blood requests are accepted and satisfied, completed records will be archived here."}
                          </p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Request ID</th>
                                <th>Patient Details</th>
                                <th>Blood Demand</th>
                                <th>Requester Information</th>
                                <th>Fulfilled By (Donor)</th>
                                <th>Completion Date</th>
                                <th>Status</th>
                                <th>Mediation Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredFulfilled.map(r => (
                                <tr key={r.id} style={{ background: '#f0fdf4' }}>
                                  <td>
                                    <span style={{ fontWeight: 700, color: '#15803d', fontFamily: 'monospace' }}>
                                      #REQ-{r.id}
                                    </span>
                                  </td>
                                  <td>
                                    <b style={{ color: 'var(--navy)', fontSize: '0.95rem' }}>
                                      {r.patientName || 'Emergency Patient'}
                                    </b>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      📍 {r.city} {r.hospitalLocation ? `(${r.hospitalLocation})` : ''}
                                    </div>
                                    <span className={`priority-badge ${r.priority}`} style={{ fontSize: '0.7rem', marginTop: '4px', display: 'inline-block' }}>
                                      {r.priority}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span className="blood-pill">{r.bloodGroup}</span>
                                      <b style={{ color: 'var(--navy)', fontSize: '0.9rem' }}>{r.unitsRequired} Unit(s)</b>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      {r.component}
                                    </div>
                                  </td>
                                  <td>
                                    <b style={{ color: 'var(--navy)', fontSize: '0.88rem' }}>
                                      {r.requesterName || 'Hospital Patient'}
                                    </b>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      📞 {r.requesterPhone || 'N/A'}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                      ✉️ {r.requesterEmail || 'N/A'}
                                    </div>
                                  </td>
                                  <td>
                                    {r.assignedDonorName ? (
                                      <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '6px 10px', borderRadius: '6px' }}>
                                        <b style={{ color: '#15803d', fontSize: '0.9rem' }}>{r.assignedDonorName}</b>
                                        <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '2px' }}>
                                          📞 {r.assignedDonorPhone || 'N/A'}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#166534' }}>
                                          ✉️ {r.assignedDonorEmail || 'N/A'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '2px' }}>
                                          📍 {r.assignedDonorCity || r.city}
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fulfilled via registry</span>
                                    )}
                                  </td>
                                  <td>
                                    <span style={{ fontWeight: 600, color: 'var(--navy)' }}>
                                      {r.updatedAt ? r.updatedAt.split('T')[0] : (r.createdAt ? r.createdAt.split('T')[0] : 'Completed')}
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '4px 10px',
                                      borderRadius: '12px',
                                      background: '#16a34a',
                                      color: '#ffffff',
                                      fontWeight: 800,
                                      fontSize: '0.8rem'
                                    }}>
                                      ✅ FULFILLED
                                    </span>
                                  </td>
                                  <td style={{ maxWidth: '240px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    {r.hospitalAlertMessage || 'Request fulfilled and verified by hospital mediator.'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </div>
                );
              })()}

              {/* ------------------------------------------------------------- */}
              {/* HOSPITAL: REQUESTS TAB                                         */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'HOSPITAL' && activeTab === 'requests' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Hospital Blood Requests</h2>
                      <p>Track your active blood requests, view timelines, and coordinate donor responses.</p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('create')}>
                      + New Request
                    </button>
                  </div>

                  {hospitalRequests.length === 0 ? (
                    <div className="empty-state-card">
                      <div className="empty-state-icon">📋</div>
                      <div className="empty-state-title">No Requests Submitted Yet</div>
                      <p className="empty-state-desc">You have not submitted any blood requests yet. Click "+ New Request" to create your first supply order.</p>
                      <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('create')}>
                        Create Blood Request
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {hospitalRequests.map(r => (
                        <div key={r.id} style={{
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '1.25rem',
                          background: r.priority === 'CRITICAL' ? 'var(--danger-bg)' : 'var(--bg-card)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="blood-pill">{r.bloodGroup}</span>
                              <span className={`priority-badge ${r.priority}`}>{r.priority}</span>
                              <span className={`status-badge ${r.status}`}>{r.status}</span>
                              <b style={{ color: 'var(--navy)' }}>{r.unitsRequired} Unit(s) · {r.component}</b>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Required by: {r.requiredDate}</span>
                          </div>

                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            📍 {r.city} {r.hospitalLocation ? `(${r.hospitalLocation})` : ''} — {r.notes || 'Routine requirement'}
                          </p>

                          {r.emergencyReason && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--danger)', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px' }}>
                              <b>Emergency Justification:</b> {r.emergencyReason}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => handleViewRequestMatches(r.id)}>
                              👥 View Compatible Donors & Responses
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleViewTimeline(r.id)}>
                              ⏱️ Visual Timeline
                            </button>
                            {r.status === 'OPEN' && (
                              <button className="btn btn-outline btn-sm" onClick={() => handleUpdateHospitalRequestStatus(r.id, 'IN_PROGRESS')}>
                                Mark In-Progress
                              </button>
                            )}
                            {r.status !== 'FULFILLED' && (
                              <button className="btn btn-primary btn-sm" onClick={() => handleUpdateHospitalRequestStatus(r.id, 'FULFILLED')}>
                                Mark Fulfilled
                              </button>
                            )}
                            {r.status !== 'CANCELLED' && r.status !== 'FULFILLED' && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleUpdateHospitalRequestStatus(r.id, 'CANCELLED')}>
                                Cancel Request
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* HOSPITAL: CREATE REQUEST TAB                                   */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'HOSPITAL' && activeTab === 'create' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Submit Blood Requirement</h2>
                      <p>Issue an emergency or standard blood supply request.</p>
                    </div>
                  </div>

                  {duplicateWarning && (
                    <div style={{
                      background: 'var(--warning-bg)',
                      border: '1px solid var(--warning)',
                      borderRadius: '10px',
                      padding: '1.25rem',
                      marginBottom: '1.5rem',
                      color: 'var(--warning)'
                    }}>
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', marginBottom: '6px' }}>
                        ⚠️ Potential Duplicate Request Detected
                      </h4>
                      <p style={{ fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '12px', color: 'var(--text-main)' }}>
                        {duplicateWarning.message}
                      </p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCreateRequest(null, true)}
                        >
                          Confirm & Create Separate Request
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setDuplicateWarning(null)}
                        >
                          Cancel / Review Existing
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={e => handleCreateRequest(e, false)}>
                    <div className="form-row-3">
                      <div className="form-group">
                        <label>Blood Group Required</label>
                        <select
                          value={createReqForm.bloodGroup}
                          onChange={e => setCreateReqForm({ ...createReqForm, bloodGroup: e.target.value })}
                        >
                          {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Donation Component</label>
                        <select
                          value={createReqForm.component}
                          onChange={e => setCreateReqForm({ ...createReqForm, component: e.target.value })}
                        >
                          {COMPONENTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Units Required</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          required
                          value={createReqForm.unitsRequired}
                          onChange={e => setCreateReqForm({ ...createReqForm, unitsRequired: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Priority Level</label>
                        <select
                          value={createReqForm.priority}
                          onChange={e => setCreateReqForm({ ...createReqForm, priority: e.target.value })}
                        >
                          <option value="NORMAL">NORMAL (Scheduled / Routine)</option>
                          <option value="URGENT">URGENT (Required within 24 Hours)</option>
                          <option value="CRITICAL">CRITICAL (Immediate Trauma / Life-Threatening)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Required Date</label>
                        <input
                          type="date"
                          required
                          value={createReqForm.requiredDate}
                          onChange={e => setCreateReqForm({ ...createReqForm, requiredDate: e.target.value })}
                        />
                      </div>
                    </div>

                    {createReqForm.priority !== 'NORMAL' && (
                      <div className="form-group">
                        <label style={{ color: 'var(--danger)' }}>Emergency Clinical Justification *</label>
                        <input
                          required
                          placeholder="e.g. acute trauma code, bypass surgery reserve, postpartum hemorrhage"
                          value={createReqForm.emergencyReason}
                          onChange={e => setCreateReqForm({ ...createReqForm, emergencyReason: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="form-row-2">
                      <div className="form-group">
                        <label>City</label>
                        <input
                          required
                          value={createReqForm.city}
                          onChange={e => setCreateReqForm({ ...createReqForm, city: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label>Hospital Campus / Ward Location</label>
                        <input
                          placeholder="e.g. ICU Block 3, 2nd Floor Blood Bank"
                          value={createReqForm.hospitalLocation}
                          onChange={e => setCreateReqForm({ ...createReqForm, hospitalLocation: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Clinical Notes</label>
                      <textarea
                        rows={3}
                        placeholder="Additional details for donor coordination..."
                        value={createReqForm.notes}
                        onChange={e => setCreateReqForm({ ...createReqForm, notes: e.target.value })}
                      />
                    </div>

                    <button className="btn btn-primary" disabled={loading}>
                      {loading ? 'Submitting…' : 'Submit Blood Request →'}
                    </button>
                  </form>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* HOSPITAL: SMART MATCHES TAB                                    */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'HOSPITAL' && activeTab === 'matching' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Smart Donor Candidate Matches</h2>
                      <p>Ranked discoverable volunteers for request #{viewingRequestId || 'Active'}.</p>
                    </div>
                  </div>

                  {selectedRequestMatches.length === 0 ? (
                    <div className="empty-state-card">
                      <div className="empty-state-icon">🎯</div>
                      <div className="empty-state-title">Select a Request to View Matches</div>
                      <p className="empty-state-desc">Go to the "Hospital Requests" tab and click "View Compatible Donors & Responses" on any request.</p>
                      <button className="btn btn-outline btn-sm" onClick={() => setActiveTab('requests')}>
                        Go to Requests
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h4 style={{ color: 'var(--navy)', marginBottom: '1rem' }}>
                        Matching Donors for Request #{viewingRequestId} ({selectedRequestMatches.length} candidates)
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                        {selectedRequestMatches.map(m => (
                          <div key={m.donorId} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', background: 'var(--bg-surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <b>Donor #{m.donorId} ({m.donorName})</b>
                              <span className="blood-pill">{m.bloodGroup}</span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>📍 {m.city}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: '700', marginBottom: '8px' }}>Match Score: {m.matchScore} pts</div>

                            <ul style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '16px', marginBottom: '10px' }}>
                              {m.reasons.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>

                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setConfirmDonationForm(prev => ({
                                  ...prev,
                                  donorId: m.donorId,
                                  bloodRequestId: viewingRequestId
                                }))
                                setActiveTab('confirm')
                              }}
                            >
                              Record Completed Donation
                            </button>
                          </div>
                        ))}
                      </div>

                      <h4 style={{ color: 'var(--navy)', marginBottom: '0.75rem' }}>
                        Incoming Donor Responses ({selectedRequestResponses.length})
                      </h4>
                      {selectedRequestResponses.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No donor responses submitted yet for this request.</p>
                      ) : (
                        <div className="table-responsive">
                          <table className="styled-table">
                            <thead>
                              <tr>
                                <th>Donor</th>
                                <th>Blood Group</th>
                                <th>Phone</th>
                                <th>Response</th>
                                <th>Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedRequestResponses.map(r => (
                                <tr key={r.id}>
                                  <td>{r.donorName}</td>
                                  <td><span className="blood-pill">{r.bloodGroup}</span></td>
                                  <td>{r.phone || 'Protected'}</td>
                                  <td><span className={`status-badge ${r.status === 'ACCEPTED' ? 'FULFILLED' : 'CANCELLED'}`}>{r.status}</span></td>
                                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* HOSPITAL: CONFIRM DONATION TAB                                 */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'HOSPITAL' && activeTab === 'confirm' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Confirm Completed Donation</h2>
                      <p>Create an official immutable donation record after verifying physical collection.</p>
                    </div>
                  </div>

                  <form onSubmit={handleConfirmDonation} style={{ maxWidth: '580px' }}>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Donor ID *</label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 5"
                          value={confirmDonationForm.donorId}
                          onChange={e => setConfirmDonationForm({ ...confirmDonationForm, donorId: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label>Blood Request ID (Optional)</label>
                        <input
                          type="number"
                          placeholder="e.g. 12"
                          value={confirmDonationForm.bloodRequestId}
                          onChange={e => setConfirmDonationForm({ ...confirmDonationForm, bloodRequestId: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-row-3">
                      <div className="form-group">
                        <label>Units Collected</label>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          required
                          value={confirmDonationForm.unitsDonated}
                          onChange={e => setConfirmDonationForm({ ...confirmDonationForm, unitsDonated: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label>Component</label>
                        <select
                          value={confirmDonationForm.component}
                          onChange={e => setConfirmDonationForm({ ...confirmDonationForm, component: e.target.value })}
                        >
                          {COMPONENTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Collection Date</label>
                        <input
                          type="date"
                          required
                          value={confirmDonationForm.donationDate}
                          onChange={e => setConfirmDonationForm({ ...confirmDonationForm, donationDate: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Verification Notes</label>
                      <textarea
                        rows={2}
                        placeholder="Confirmation details: phlebotomist staff name, bag batch code..."
                        value={confirmDonationForm.notes}
                        onChange={e => setConfirmDonationForm({ ...confirmDonationForm, notes: e.target.value })}
                      />
                    </div>

                    <button className="btn btn-primary" disabled={loading}>
                      ✓ Confirm & Log Official Donation Record
                    </button>
                  </form>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* ADMIN: ANALYTICS DASHBOARD & CHARTS                            */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'ADMIN' && (activeTab === 'analytics' || activeTab === 'overview') && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>System Analytics & Performance Metrics</h2>
                      <p>Aggregated directly from MySQL database · Last calculated: {adminSummary?.generatedAt ? new Date(adminSummary.generatedAt).toLocaleTimeString() : 'now'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => downloadCsv('/admin/reports/requests/csv', 'blood_requests_report.csv')}>
                        📥 Export Requests CSV
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => downloadCsv('/admin/reports/donations/csv', 'donation_history_report.csv')}>
                        📥 Export Donations CSV
                      </button>
                    </div>
                  </div>

                  <div className="metric-row">
                    <div className="stat-card">
                      <div className="stat-card-title">Active Donors</div>
                      <div className="stat-card-value">{adminSummary?.totalActiveDonors ?? '—'}</div>
                      <div className="stat-card-sub">Registered volunteer accounts</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card-title">Registered Hospitals</div>
                      <div className="stat-card-value">{adminSummary?.totalHospitals ?? '—'}</div>
                      <div className="stat-card-sub">Accredited medical centers</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card-title">Total Requests</div>
                      <div className="stat-card-value">{adminSummary?.totalRequests ?? '—'}</div>
                      <div className="stat-card-sub">
                        {adminSummary?.urgentRequests ?? 0} Urgent · {adminSummary?.criticalRequests ?? 0} Critical
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card-title">Confirmed Donations</div>
                      <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                        {adminSummary?.totalConfirmedDonations ?? '—'}
                      </div>
                      <div className="stat-card-sub">{adminSummary?.totalUnitsDonated ?? 0} Total Units Collected</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginTop: '1.5rem' }}>
                    <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <h4 style={{ color: 'var(--navy)', marginBottom: '4px' }}>Donor Inventory by Blood Group</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Distribution of active discoverable donors</p>

                      <div className="chart-bar-container">
                        {adminSummary?.donorsByBloodGroup && Object.entries(adminSummary.donorsByBloodGroup).map(([bg, count]) => {
                          const maxCount = Math.max(1, ...Object.values(adminSummary.donorsByBloodGroup))
                          const pct = Math.round((count / maxCount) * 100)
                          return (
                            <div key={bg} className="chart-bar-row">
                              <span className="chart-bar-label">{bg}</span>
                              <div className="chart-bar-track">
                                <div className="chart-bar-fill" style={{ width: `${Math.max(4, pct)}%` }} />
                              </div>
                              <span className="chart-bar-count">{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <h4 style={{ color: 'var(--navy)', marginBottom: '4px' }}>Monthly Activity Trends</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Requests created vs confirmed donations</p>

                      <div className="table-responsive" style={{ marginTop: '1rem' }}>
                        <table className="styled-table" style={{ background: 'var(--bg-card)' }}>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>Requests Created</th>
                              <th>Donations Confirmed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminSummary?.monthlyTrends?.map(t => (
                              <tr key={t.month}>
                                <td><b>{t.month}</b></td>
                                <td>{t.requests}</td>
                                <td><span style={{ color: 'var(--success)', fontWeight: '700' }}>{t.donations}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* ADMIN: REQUESTS MODERATION                                     */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'ADMIN' && activeTab === 'moderation' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>All Blood Requests Moderation</h2>
                      <p>Review priority classifications, view event timelines, and update fulfillment.</p>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="styled-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Hospital</th>
                          <th>Group</th>
                          <th>Units</th>
                          <th>City</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Timeline</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminRequests.map(r => (
                          <tr key={r.id}>
                            <td>#{r.id}</td>
                            <td><b>{r.hospitalName}</b></td>
                            <td><span className="blood-pill">{r.bloodGroup}</span></td>
                            <td>{r.unitsRequired}</td>
                            <td>{r.city}</td>
                            <td>
                              <select
                                value={r.priority}
                                onChange={e => handleAdminUpdatePriority(r.id, e.target.value)}
                                style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}
                              >
                                <option value="NORMAL">NORMAL</option>
                                <option value="URGENT">URGENT</option>
                                <option value="CRITICAL">CRITICAL</option>
                              </select>
                            </td>
                            <td><span className={`status-badge ${r.status}`}>{r.status}</span></td>
                            <td>
                              <button className="btn btn-outline btn-sm" onClick={() => handleViewTimeline(r.id)}>
                                ⏱️ Timeline
                              </button>
                            </td>
                            <td>
                              <select
                                value={r.status}
                                onChange={e => handleAdminUpdateStatus(r.id, e.target.value)}
                                style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}
                              >
                                <option value="OPEN">OPEN</option>
                                <option value="IN_PROGRESS">IN_PROGRESS</option>
                                <option value="FULFILLED">FULFILLED</option>
                                <option value="CANCELLED">CANCELLED</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* ADMIN: USER ACCOUNTS MANAGEMENT                                */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'ADMIN' && activeTab === 'users' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>User Accounts Management</h2>
                      <p>View registered participants and suspend/reactivate accounts.</p>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="styled-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>City</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map(u => (
                          <tr key={u.id}>
                            <td>#{u.id}</td>
                            <td><b>{u.name}</b></td>
                            <td>{u.email}</td>
                            <td><span className="user-role-tag">{u.role}</span></td>
                            <td>{u.city || '—'}</td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                background: u.status === 'ACTIVE' ? 'var(--success-bg)' : 'var(--danger-bg)',
                                color: u.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)'
                              }}>
                                {u.status}
                              </span>
                            </td>
                            <td>
                              {u.role !== 'ADMIN' && (
                                <button
                                  className={`btn ${u.status === 'ACTIVE' ? 'btn-danger' : 'btn-primary'} btn-sm`}
                                  onClick={() => handleAdminUserStatus(u.id, u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                                >
                                  {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* ADMIN: SECURITY AUDIT LOGS                                     */}
              {/* ------------------------------------------------------------- */}
              {user.role === 'ADMIN' && activeTab === 'audit' && (
                <div className="card-panel">
                  <div className="card-panel-header">
                    <div>
                      <h2>Security & Compliance Audit Trail</h2>
                      <p>Immutable log of registrations, logins, status changes, and QR revocations.</p>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="styled-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Actor</th>
                          <th>Role</th>
                          <th>Action</th>
                          <th>Target</th>
                          <th>Details</th>
                          <th>IP Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminAuditLogs.map(l => (
                          <tr key={l.id}>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {new Date(l.createdAt).toLocaleString()}
                            </td>
                            <td><b>{l.actorEmail || 'System'}</b></td>
                            <td><span className="user-role-tag">{l.actorRole || 'SYSTEM'}</span></td>
                            <td><span style={{ fontWeight: '700', fontSize: '0.8rem' }}>{l.action}</span></td>
                            <td>{l.targetReference}</td>
                            <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.details}</td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.ipAddress || '127.0.0.1'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </main>

      {/* Visual Request Lifecycle Timeline Modal */}
      {timelineModalData && (
        <div className="modal-overlay">
          <div className="modal-content-card">
            <div className="modal-header">
              <h3>Blood Request #{timelineModalData.requestId} Lifecycle Timeline</h3>
              <button className="modal-close-btn" onClick={() => setTimelineModalData(null)}>×</button>
            </div>

            {timelineModalData.loading ? (
              <div>
                <div className="skeleton-row" />
                <div className="skeleton-row" />
              </div>
            ) : timelineModalData.events.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No lifecycle events recorded for this request yet.</p>
            ) : (
              <div className="timeline-container">
                {timelineModalData.events.map((e, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-connector" />
                    <div className={`timeline-node ${e.badgeVariant || 'info'}`}>
                      {e.eventType === 'CREATED' && '✚'}
                      {e.eventType === 'ESCALATED' && '🚨'}
                      {e.eventType === 'DONOR_RESPONDED' && '👤'}
                      {e.eventType === 'CONFIRMED' && '💉'}
                      {e.eventType === 'FULFILLED' && '✅'}
                      {e.eventType === 'CANCELLED' && '❌'}
                    </div>
                    <div className="timeline-body">
                      <div className="timeline-body-header">
                        <span className="timeline-body-title">{e.title}</span>
                        <span className="timeline-body-time">{e.timestamp ? new Date(e.timestamp).toLocaleString() : ''}</span>
                      </div>
                      <div className="timeline-body-actor">Actor: <b>{e.actorName}</b> ({e.actorRole})</div>
                      <div className="timeline-body-details">{e.details}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setTimelineModalData(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="modal-overlay">
          <div className="modal-content-card">
            <div className="modal-header">
              <h3>{confirmDialog.title}</h3>
              <button className="modal-close-btn" onClick={() => setConfirmDialog(null)}>×</button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-outline" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmDialog.onConfirm}>
                {confirmDialog.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hospital Mediator: Search & Dispatch to Donor Modal */}
      {mediationModalOpen && selectedMediationReq && (
        <div className="modal-overlay">
          <div className="modal-content-card" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h3>Find Donors for Request #{selectedMediationReq.id}</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Patient: <b>{selectedMediationReq.patientName || 'Patient'}</b> · Blood Group: <span className="blood-pill">{selectedMediationReq.bloodGroup}</span> · City: <b>{selectedMediationReq.city}</b>
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setMediationModalOpen(false)}>×</button>
            </div>

            {loading ? (
              <div>
                <div className="skeleton-row" />
                <div className="skeleton-row" />
                <div className="skeleton-row" />
              </div>
            ) : mediationMatches.length === 0 ? (
              <div className="empty-state-card" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-icon">🔍</div>
                <div className="empty-state-title">No Matching Active Donors Found</div>
                <p className="empty-state-desc">
                  There are currently no active discoverable {selectedMediationReq.bloodGroup} donors available in {selectedMediationReq.city}.
                </p>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    setMediationModalOpen(false);
                    setNotAvailableModalReqId(selectedMediationReq.id);
                  }}
                >
                  ⚠️ Send 'Not Available' Alert to Requester
                </button>
              </div>
            ) : (
              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <div className="mediation-donor-list">
                  {mediationMatches.map(d => (
                    <div key={d.id} className="mediation-donor-item">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <b style={{ color: 'var(--navy)' }}>{d.displayName}</b>
                          <span className="blood-pill">{d.bloodGroup}</span>
                          <span style={{ fontSize: '0.72rem', background: 'var(--success-bg)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            Score: {d.matchScore} pts
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          📍 {d.city} · {d.cooldownMet ? '✓ Cooldown Met' : '⚠️ Recent Donation'}
                        </div>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSendRequestToDonor(selectedMediationReq.id, d.id, d.displayName)}
                      >
                        ✉️ Send Request to Donor
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button
                className="btn btn-outline btn-sm"
                style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                onClick={() => {
                  setMediationModalOpen(false);
                  setNotAvailableModalReqId(selectedMediationReq.id);
                }}
              >
                ⚠️ Send Not Available Alert
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setMediationModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hospital Mediator: Send Not Available Alert Reason Modal */}
      {notAvailableModalReqId && (
        <div className="modal-overlay">
          <div className="modal-content-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Send 'Not Available' Alert (Request #{notAvailableModalReqId})</h3>
              <button className="modal-close-btn" onClick={() => setNotAvailableModalReqId(null)}>×</button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              This will update the blood request status to NOT AVAILABLE and immediately alert the patient requester in their portal inbox.
            </p>
            <div className="form-group">
              <label>Reason / Clinical Explanation (Optional)</label>
              <textarea
                rows={3}
                placeholder="e.g. Searched registry; no compatible active donors in this location currently available."
                value={notAvailableReasonInput}
                onChange={e => setNotAvailableReasonInput(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setNotAvailableModalReqId(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleSendNotAvailableAlert(notAvailableModalReqId)}>
                Send Not Available Alert →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hospital Mediator: Send Message & Donor Details to Requester Modal */}
      {sendAvailableModalData && (
        <div className="modal-overlay">
          <div className="modal-content-card" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div>
                <h3>📢 Send Message & Donor Details to Requester</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Request #{sendAvailableModalData.reqId} · Patient: <b>{sendAvailableModalData.patientName || 'Emergency Patient'}</b>
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setSendAvailableModalData(null)}>×</button>
            </div>

            <div style={{
              background: 'var(--success-bg)',
              border: '1px solid var(--success)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '1rem',
              fontSize: '0.85rem'
            }}>
              <b style={{ color: '#065f46' }}>✅ Verified Donor Information to be Revealed:</b>
              <div style={{ marginTop: '6px', color: '#065f46', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>• <b>Donor Name:</b> {sendAvailableModalData.donorName}</div>
                <div>• <b>Blood Group:</b> {sendAvailableModalData.donorBloodGroup}</div>
                <div>• <b>Contact Phone:</b> {sendAvailableModalData.donorPhone || 'N/A'}</div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label>Hospital Message to Requester:</label>
              <textarea
                className="form-control"
                rows={4}
                value={availableCustomMessage}
                onChange={(e) => setAvailableCustomMessage(e.target.value)}
                placeholder="Enter hospital message to accompany the donor details..."
              />
              <span className="form-hint">
                This message and the donor's contact phone number will be unlocked and displayed in the patient's Requester Portal.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setSendAvailableModalData(null)}>Cancel</button>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--success)', color: '#fff', fontWeight: 700 }}
                onClick={handleConfirmSendAvailableAlert}
              >
                Send Message & Reveal Donor Details →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer-container">
        <div className="footer-inner">
          <button className="brand-wrapper" onClick={() => setPage('home')}>
            <div className="brand-icon-box" style={{ width: '32px', height: '32px', fontSize: '18px' }}>✚</div>
            <div>
              <span className="brand-name" style={{ fontSize: '1rem' }}>LifeDrop</span>
              <small className="brand-sub">Blood Donor Management</small>
            </div>
          </button>
          <div className="footer-copy">
            © {new Date().getFullYear()} LifeDrop Platform · Designed for Clinical Blood Coordination & Academic Demonstration.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="nav-item-btn" onClick={() => setPage('privacy')}>Privacy Terms</button>
            <button className="nav-item-btn" onClick={() => setPage('verify')}>Card Verification</button>
            <a className="nav-item-btn" href="http://localhost:8080/swagger-ui.html" target="_blank" rel="noreferrer">
              Swagger API Docs ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
