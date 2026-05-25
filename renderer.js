// ============================================================
// POLICE WIRELESS LEAVE SYSTEM — renderer.js
// Full workflow: Employee → Submitting → Granting → Approving
// ============================================================

const ROLES = ['Employee', 'Submitting Officer', 'Granting Officer', 'Approving Officer'];

const LEAVE_TYPES = [
  // ── Single-stage (Submitting Officer sanctions directly) ──
  { name: 'Casual Leave',               days: 'Up to 15 days/year',            icon: '🏖️', singleStage: true,  note: 'PC / HC / ASI / PSI / PI eligible' },
  { name: 'Restricted Holiday (RH)',    days: '2 days/year from RH list',      icon: '🎌', singleStage: true,  note: 'Choose from Govt. RH calendar' },
  { name: 'General Holiday',            days: 'As per Govt. holiday calendar', icon: '🏛️', singleStage: true,  note: 'National/State public holidays' },
  { name: 'Weekly Off',                 days: 'As per duty roster',            icon: '📅', singleStage: true,  note: 'Applicable to PC / HC / ASI ranks' },
  // ── Multi-stage (full workflow) ──
  { name: 'Earned Leave',               days: 'Accrued — 1 day per 11 duty days', icon: '🌿', singleStage: false },
  { name: 'Half Pay Leave',             days: '20 days/year',                  icon: '💊', singleStage: false },
  { name: 'Commuted Leave',             days: 'Up to 180 days',                icon: '🔄', singleStage: false },
  { name: 'Medical Leave',              days: 'Per authorised medical advice', icon: '🏥', singleStage: false },
  { name: 'Special Casual Leave',       days: 'Specific permitted occasions',  icon: '⭐', singleStage: false },
  { name: 'Maternity Leave',            days: '180 days',                      icon: '👶', singleStage: false },
  { name: 'Paternity Leave',            days: '15 days (max 2 times in service)', icon: '👨‍👩‍👧', singleStage: false },
  { name: 'Extraordinary Leave',        days: 'No pay',                        icon: '📄', singleStage: false }
];

// Leaves that go only to Submitting Officer who sanctions directly
const SINGLE_STAGE_LEAVES = new Set(
  LEAVE_TYPES.filter(lt => lt.singleStage).map(lt => lt.name)
);

function isSingleStageLeave(leaveType) {
  return SINGLE_STAGE_LEAVES.has(leaveType);
}

const WORKFLOW_STEPS = [
  { key: 'employee',   label: 'Employee',          status: 'Draft / Correction',              icon: '👤' },
  { key: 'submitting', label: 'Submitting Officer', status: 'Pending with Submitting Officer', icon: '📋' },
  { key: 'granting',   label: 'Granting Officer',  status: 'Pending with Granting Officer',   icon: '📝' },
  { key: 'approving',  label: 'Approving Officer', status: 'Pending with Approving Officer',  icon: '⚖️' },
  { key: 'final',      label: 'Final Decision',    status: 'Sanctioned / Closed',             icon: '✅' }
];

// ---- DOM ----
const $ = (id) => document.getElementById(id);

const roleSelect         = $('role');
const employeeSelectRow  = $('employee-select-row');
const employeeSelect     = $('employee-select');
const submittingSelectRow = $('submitting-select-row');
const submittingSelect   = $('submitting-select');
const grantingSelectRow  = $('granting-select-row');
const grantingSelect     = $('granting-select');
const approvingSelectRow = $('approving-select-row');
const approvingSelect    = $('approving-select');

const kgidInput    = $('kgid');
const mobileInput  = $('mobile');
const loginButton  = $('login-button');
const otpSection   = $('otp-section');
const otpCodeEl    = $('otp-code');
const otpInput     = $('otp');
const verifyButton = $('verify-button');
const messageEl    = $('message');

const dashboardScreen = $('dashboard-screen');
const loginScreen     = $('login-screen');
const dashboardTitle  = $('dashboard-title');
const dashboardSub    = $('dashboard-subtitle');
const userRoleBadge   = $('user-role');
const logoutButton    = $('logout-button');

const navButtons = document.querySelectorAll('.nav-item');
const panels     = document.querySelectorAll('.panel');

const userNameEl        = $('user-name');
const userRankEl        = $('user-rank');
const userKgidEl        = $('user-kgid');
const userPlaceEl       = $('user-place');
const userDesignationEl = $('user-designation');
const userDistrictEl    = $('user-district');
const userMobileEl      = $('user-mobile');

const leaveTypeSelect      = $('leave-type');
const fromDateInput        = $('from-date');
const toDateInput          = $('to-date');
const leaveDaysInput       = $('leave-days');
const applySubmittingSelect = $('apply-submitting-officer');
const applyGrantingSelect  = $('apply-granting-officer');
const applyApprovingSelect = $('apply-approving-officer');
const reasonInput          = $('leave-reason');
const attachmentsInput     = $('attachments');
const submitLeaveButton    = $('submit-leave-button');
const applyResult          = $('apply-result');

const trackList      = $('track-list');
const trackCount     = $('track-count');
const inboxTableBody = $('inbox-table-body');
const inboxCount     = $('inbox-count');
const notificationList = $('notification-list');

// ---- State ----
let employees = [];
let currentUser = null;
let currentOtp  = null;
let currentRole = 'Employee';
let leaveApplications = [];
let notifications = [];
let editingApplicationId = null;

// ============================================================
// HELPERS
// ============================================================

function isPotentialSubmittingOfficer(emp) {
  const r = String(emp.rank || '').toUpperCase();
  const d = String(emp.designation || '').toUpperCase();
  return r === 'PI' || r === 'DSP/ACP' || r === 'PSI' ||
         d.includes('INSPECTOR') || d.includes('DEPUTY SUPERINTENDENT') || d.includes('SUB-INSPECTOR');
}

function isPotentialGrantingOfficer(emp) {
  const r = String(emp.rank || '').toUpperCase();
  const d = String(emp.designation || '').toUpperCase();
  return r === 'DSP/ACP' || r === 'SP' ||
         d.includes('DEPUTY SUPERINTENDENT') || d.includes('SUPERINTENDENT') || d.includes('COMMISSIONER');
}

function isPotentialApprovingOfficer(emp) {
  const r = String(emp.rank || '').toUpperCase();
  const d = String(emp.designation || '').toUpperCase();
  return r === 'SP' || r === 'DIG' || r === 'IGP' ||
         d.includes('SUPERINTENDENT') || d.includes('DEPUTY INSPECTOR GENERAL') ||
         d.includes('COMMISSIONER') || d.includes('DIRECTOR GENERAL');
}

function normalizeEmployee(emp, idx) {
  return {
    id:           String(emp.kgid || emp.KGID || idx),
    slNo:         emp.sl_no || '',
    name:         emp.employee_name || emp['Employee Name'] || 'Unnamed',
    rank:         emp.short_rank || emp.Rank || '',
    designation:  emp.designation || emp.Designation || '',
    kgid:         String(emp.kgid || emp.KGID || '').trim(),
    workingPlace: emp.working_place || emp['Working Place'] || '',
    mobile:       String(emp.mobile_number || emp['Mobile Number'] || '').trim(),
    district:     emp.district || emp.District || 'Not Available'
  };
}

function escapeHtml(val) {
  return String(val ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[c]);
}

function setMessage(text, type = 'error', target = messageEl) {
  if (!target) return;
  target.textContent = text;
  target.className = `message ${type}`;
}

function saveDatabase() {
  window.api.saveLeaveApplications(leaveApplications);
  window.api.saveNotifications(notifications);
}

function addNotification(text, kgid = null, role = null) {
  notifications.unshift({ text, kgid, role, time: new Date().toLocaleString() });
  saveDatabase();
}

// ============================================================
// DROPDOWN RENDERERS
// ============================================================

function renderRoleOptions() {
  if (!roleSelect) return;
  roleSelect.innerHTML = '<option value="" disabled selected>— Choose your login role —</option>' +
    ROLES.map(r => `<option value="${r}">${r}</option>`).join('');
}

function buildOption(emp) {
  const rankLabel = emp.rank || emp.designation || 'Staff';
  return `<option value="${escapeHtml(emp.kgid)}">${escapeHtml(emp.name)} — ${escapeHtml(rankLabel)} (KGID: ${escapeHtml(emp.kgid)})</option>`;
}

function renderEmployeeDropdowns() {
  if (!employeeSelect) return;
  const sorted = [...employees].sort((a, b) => a.name.localeCompare(b.name));

  employeeSelect.innerHTML =
    '<option value="" disabled selected>Select employee from HRMS database</option>' +
    sorted.map(buildOption).join('');

  const subList  = sorted.filter(isPotentialSubmittingOfficer);
  const grantList = sorted.filter(isPotentialGrantingOfficer);
  const appList  = sorted.filter(isPotentialApprovingOfficer);

  submittingSelect.innerHTML =
    '<option value="" disabled selected>Select Submitting Officer (PI / DSP)</option>' +
    subList.map(buildOption).join('');

  grantingSelect.innerHTML =
    '<option value="" disabled selected>Select Granting Officer (DSP / SP)</option>' +
    grantList.map(buildOption).join('');

  approvingSelect.innerHTML =
    '<option value="" disabled selected>Select Approving Officer (SP / DIG)</option>' +
    appList.map(buildOption).join('');

  // Apply form dropdowns
  if (applySubmittingSelect)
    applySubmittingSelect.innerHTML =
      '<option value="">— Choose Submitting Officer —</option>' +
      subList.map(e => `<option value="${escapeHtml(e.kgid)}">${escapeHtml(e.name)} (${escapeHtml(e.rank || 'PI')})</option>`).join('');

  if (applyGrantingSelect)
    applyGrantingSelect.innerHTML =
      '<option value="">— Choose Granting Officer —</option>' +
      grantList.map(e => `<option value="${escapeHtml(e.kgid)}">${escapeHtml(e.name)} (${escapeHtml(e.rank || 'DSP')})</option>`).join('');

  if (applyApprovingSelect)
    applyApprovingSelect.innerHTML =
      '<option value="">— Choose Approving Officer —</option>' +
      appList.map(e => `<option value="${escapeHtml(e.kgid)}">${escapeHtml(e.name)} (${escapeHtml(e.rank || 'SP')})</option>`).join('');
}

function renderLeaveTypes() {
  if (!leaveTypeSelect) return;
  leaveTypeSelect.innerHTML =
    '<option value="">— Select leave type under KCSR —</option>' +
    LEAVE_TYPES.map(lt => {
      const tag = lt.singleStage ? ' [Single-stage]' : '';
      return `<option value="${lt.name}">${lt.icon} ${lt.name} (${lt.days})${tag}</option>`;
    }).join('');
}

function selectEmployeeByKgid(kgid) {
  const found = employees.find(e => e.kgid === String(kgid || '').trim());
  if (!found) { kgidInput.value = ''; mobileInput.value = ''; return; }
  kgidInput.value  = found.kgid;
  mobileInput.value = found.mobile;
}

// ============================================================
// DATA LOAD
// ============================================================

function loadData() {
  employees = (window.api.loadEmployees() || [])
    .map(normalizeEmployee)
    .filter(e => e.kgid && e.name);
  leaveApplications = window.api.loadLeaveApplications() || [];
  notifications     = window.api.loadNotifications()     || [];
}

// ============================================================
// OTP LOGIN
// ============================================================

function findEmployee(kgid) {
  return employees.find(e => e.kgid === String(kgid).trim());
}

function sendOtp() {
  currentRole = roleSelect.value;
  const kgid  = kgidInput.value.trim();

  if (!currentRole) { setMessage('Please select your login role.'); return; }
  if (!kgid)        { setMessage('Please select an employee/officer from the dropdown.'); return; }

  const user = findEmployee(kgid);
  if (!user)  { setMessage('KGID not found in the HRMS database. Please verify your selection.'); return; }

  currentUser = user;
  currentOtp  = Math.floor(100000 + Math.random() * 900000).toString();

  otpCodeEl.textContent = `🔐 Demo OTP for ${user.name} (KGID ${user.kgid}): ${currentOtp}`;
  otpSection.classList.remove('hidden');
  setMessage(`OTP generated for ${user.name}. Use the code shown above.`, 'success');
}

function verifyOtp() {
  if (!currentOtp) { setMessage('Please send OTP first.'); return; }
  if (otpInput.value.trim() !== currentOtp) {
    setMessage('Incorrect OTP. Please check and try again.');
    return;
  }
  loginSuccess();
}

function loginSuccess() {
  // Populate dashboard header
  dashboardTitle.textContent = currentUser.name;
  dashboardSub.textContent   = `${currentUser.rank || currentUser.designation || 'Staff'} · KGID ${currentUser.kgid}`;
  userRoleBadge.textContent  = currentRole;

  // Avatar icon by role
  const avatarEl = $('dh-avatar-icon');
  const roleIcons = {
    'Employee':           '👤',
    'Submitting Officer': '📋',
    'Granting Officer':   '📝',
    'Approving Officer':  '⚖️'
  };
  if (avatarEl) avatarEl.textContent = roleIcons[currentRole] || '👤';

  // Overview panel
  userNameEl.textContent        = currentUser.name;
  userRankEl.textContent        = currentUser.rank || '—';
  userKgidEl.textContent        = currentUser.kgid;
  userPlaceEl.textContent       = currentUser.workingPlace || currentUser.district || '—';
  userMobileEl.textContent      = currentUser.mobile || '—';
  userDesignationEl.textContent = currentUser.designation || '—';
  userDistrictEl.textContent    = currentUser.district || '—';

  document.body.dataset.role = currentRole.toLowerCase().replace(/\s+/g, '-');

  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');

  // Show/hide nav items
  const inboxBtn   = document.querySelector('.nav-item[data-view="inbox"]');
  const applyBtn   = document.querySelector('.nav-item[data-view="apply"]');
  const reportsBtn = document.querySelector('.nav-item[data-view="reports"]');
  if (currentRole === 'Employee') {
    if (inboxBtn)   inboxBtn.style.display = 'none';
    if (applyBtn)   applyBtn.style.display = '';
    if (reportsBtn) reportsBtn.style.display = 'none';
    showView('overview');
  } else {
    if (inboxBtn)   inboxBtn.style.display = '';
    if (applyBtn)   applyBtn.style.display = 'none';
    if (reportsBtn) reportsBtn.style.display = '';
    showView('inbox');
  }
}

function logout() {
  dashboardScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  currentUser = currentOtp = null;
  editingApplicationId = null;

  if (otpInput) otpInput.value = '';
  if (otpSection) otpSection.classList.add('hidden');
  if (submitLeaveButton) submitLeaveButton.innerHTML = '<span>🚀</span> Submit Leave Request';

  setMessage('Logged out successfully.', 'success');

  if (roleSelect)        roleSelect.value = '';
  if (employeeSelectRow) employeeSelectRow.classList.remove('hidden');
  if (employeeSelect)    employeeSelect.value = '';
  if (submittingSelectRow) submittingSelectRow.classList.add('hidden');
  if (grantingSelectRow)   grantingSelectRow.classList.add('hidden');
  if (approvingSelectRow)  approvingSelectRow.classList.add('hidden');
  document.body.removeAttribute('data-role');
}

// ============================================================
// NAVIGATION
// ============================================================

function showView(viewId) {
  panels.forEach(p => p.classList.toggle('active', p.id === viewId));
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
  if (viewId === 'track')         renderTrackList();
  if (viewId === 'inbox')         renderInbox();
  if (viewId === 'notifications') renderNotifications();
  if (viewId === 'reports')       renderReports();
}

// ============================================================
// LEAVE APPLICATION
// ============================================================

function calculateDays() {
  if (!fromDateInput.value || !toDateInput.value) {
    leaveDaysInput.value = '';
    hideDaysPreview();
    return 0;
  }
  const from = new Date(`${fromDateInput.value}T00:00:00`);
  const to   = new Date(`${toDateInput.value}T00:00:00`);

  if (to < from) {
    leaveDaysInput.value = '0';
    hideDaysPreview();
    return -1;
  }

  const diff = Math.round((to - from) / 86400000) + 1;
  leaveDaysInput.value = diff;

  const previewEl = $('days-preview');
  const previewText = $('days-preview-text');
  if (previewEl && previewText) {
    previewText.textContent = `${diff} day(s) leave from ${fromDateInput.value} to ${toDateInput.value}`;
    previewEl.classList.remove('hidden');
  }

  return diff;
}

function hideDaysPreview() {
  const el = $('days-preview');
  if (el) el.classList.add('hidden');
}

function handleLeaveTypeChange() {
  const lt = leaveTypeSelect ? leaveTypeSelect.value : '';
  const single = isSingleStageLeave(lt);

  const grantRow  = $('granting-officer-form-row');
  const appRow    = $('approving-officer-form-row');
  const singleBanner = $('single-stage-banner');

  if (grantRow)  grantRow.classList.toggle('hidden', single);
  if (appRow)    appRow.classList.toggle('hidden', single);
  if (singleBanner) singleBanner.classList.toggle('hidden', !single);

  // Reset granting/approving selects when switching to single-stage
  if (single) {
    if (applyGrantingSelect)  applyGrantingSelect.value = '';
    if (applyApprovingSelect) applyApprovingSelect.value = '';
  }

  // Show note for Weekly Off
  const weeklyNote = $('weekly-off-note');
  if (weeklyNote) weeklyNote.classList.toggle('hidden', lt !== 'Weekly Off');

  updateRoutingPreview();
}

function updateRoutingPreview() {
  const lt   = leaveTypeSelect ? leaveTypeSelect.value : '';
  const single = isSingleStageLeave(lt);
  const sub  = applySubmittingSelect  ? applySubmittingSelect.options[applySubmittingSelect.selectedIndex]  : null;
  const grt  = applyGrantingSelect    ? applyGrantingSelect.options[applyGrantingSelect.selectedIndex]      : null;
  const app  = applyApprovingSelect   ? applyApprovingSelect.options[applyApprovingSelect.selectedIndex]    : null;
  const previewEl   = $('routing-preview');
  const previewText = $('routing-preview-text');
  if (!previewEl || !previewText) return;

  if (single && sub && sub.value) {
    previewText.innerHTML = `📤 You → <strong>${escapeHtml(sub.text)}</strong> → <span style="color:var(--green);font-weight:700;">✅ Direct Sanction</span>`;
    previewEl.classList.remove('hidden');
  } else if (!single && sub && sub.value && grt && grt.value && app && app.value) {
    previewText.innerHTML = `📤 You → <strong>${escapeHtml(sub.text)}</strong> → <strong>${escapeHtml(grt.text)}</strong> → <strong>${escapeHtml(app.text)}</strong>`;
    previewEl.classList.remove('hidden');
  } else {
    previewEl.classList.add('hidden');
  }
}

function getFileTypeIconMarkup(fileName) {
  const ext = String(fileName || '').split('.').pop().toLowerCase();
  const MAP = {
    pdf:                     { color: '#dc2626', label: 'PDF' },
    jpg: { color: '#f58220', label: 'IMG' }, jpeg: { color: '#f58220', label: 'IMG' },
    png: { color: '#f58220', label: 'IMG' }, gif:  { color: '#f58220', label: 'IMG' },
    doc: { color: '#1769e0', label: 'DOC' }, docx: { color: '#1769e0', label: 'DOC' },
    xls: { color: '#16a34a', label: 'XLS' }, xlsx: { color: '#16a34a', label: 'XLS' },
    txt: { color: '#64748b', label: 'TXT' }
  };
  const info = MAP[ext] || { color: '#64748b', label: ext.toUpperCase() || 'FILE' };
  return `<span class="file-icon-badge" style="background:${info.color};">${info.label}</span>`;
}

function createLeaveApplication() {
  const leaveType   = leaveTypeSelect.value;
  const fromDate    = fromDateInput.value;
  const toDate      = toDateInput.value;
  const numDays     = calculateDays();
  const reason      = reasonInput.value.trim();
  const subKgid     = applySubmittingSelect.value;
  const grantKgid   = applyGrantingSelect.value;
  const appKgid     = applyApprovingSelect.value;
  const single      = isSingleStageLeave(leaveType);

  if (currentRole !== 'Employee') {
    setMessage('Leave application is only available for Employees.', 'error', applyResult);
    return;
  }
  if (numDays === -1) {
    setMessage('"To date" cannot be earlier than "From date".', 'error', applyResult);
    return;
  }
  if (!leaveType || !fromDate || !toDate || numDays < 1 || !reason) {
    setMessage('Please fill in leave type, valid dates, and reason.', 'error', applyResult);
    return;
  }
  if (!subKgid) {
    setMessage('Please select a Submitting Officer for routing.', 'error', applyResult);
    return;
  }
  if (!single && (!grantKgid || !appKgid)) {
    setMessage('Please select all three officers for routing (Submitting, Granting, Approving).', 'error', applyResult);
    return;
  }

  // ── Paternity Leave: max 2 times in entire service ──
  if (leaveType === 'Paternity Leave') {
    const sanctionedCount = leaveApplications.filter(a =>
      String(a.kgid) === currentUser.kgid &&
      a.type === 'Paternity Leave' &&
      a.status === 'Leave sanctioned'
    ).length;
    if (sanctionedCount >= 2) {
      setMessage('❌ Paternity Leave cannot be granted more than 2 times in entire service. You have already exhausted this entitlement.', 'error', applyResult);
      return;
    }
    const pendingCount = leaveApplications.filter(a =>
      String(a.kgid) === currentUser.kgid &&
      a.type === 'Paternity Leave' &&
      !['Leave sanctioned', 'Rejected'].includes(a.status)
    ).length;
    if (pendingCount > 0 && (sanctionedCount + pendingCount) >= 2) {
      setMessage('⚠️ You already have a Paternity Leave request pending. Max 2 times in service permitted.', 'error', applyResult);
      return;
    }
  }

  const subOfficer   = employees.find(e => e.kgid === subKgid);
  const grantOfficer = !single ? employees.find(e => e.kgid === grantKgid) : null;
  const appOfficer   = !single ? employees.find(e => e.kgid === appKgid)   : null;

  if (!subOfficer || (!single && (!grantOfficer || !appOfficer))) {
    setMessage('One or more selected officers not found in database.', 'error', applyResult);
    return;
  }

  // Save attachments
  const files = Array.from(attachmentsInput.files || []);
  const attachments = [];
  files.forEach(file => {
    try {
      const res = window.api.saveAttachment(file.path);
      if (res && res.success) {
        attachments.push({ name: res.name, originalName: file.name, size: file.size, path: res.path });
      } else {
        attachments.push({ name: file.name, originalName: file.name, error: res ? res.error : 'copy_failed' });
      }
    } catch (e) {
      attachments.push({ name: file.name, originalName: file.name, error: String(e) });
    }
  });

  const now = new Date().toLocaleString();

  if (editingApplicationId) {
    // ---- RESUBMIT EXISTING (returned for correction) ----
    const application = leaveApplications.find(a => a.id === editingApplicationId);
    if (!application) {
      setMessage('Original request not found.', 'error', applyResult);
      return;
    }
    Object.assign(application, {
      type: leaveType, fromDate, toDate, numberOfDays: numDays, reason,
      singleStage: single,
      assignedSubmittingOfficerKgid:  subOfficer.kgid,
      assignedSubmittingOfficerName:  subOfficer.name,
      assignedSubmittingOfficerRank:  subOfficer.rank,
      assignedGrantingOfficerKgid:    grantOfficer ? grantOfficer.kgid : null,
      assignedGrantingOfficerName:    grantOfficer ? grantOfficer.name : null,
      assignedGrantingOfficerRank:    grantOfficer ? grantOfficer.rank : null,
      assignedApprovingOfficerKgid:   appOfficer ? appOfficer.kgid : null,
      assignedApprovingOfficerName:   appOfficer ? appOfficer.name : null,
      assignedApprovingOfficerRank:   appOfficer ? appOfficer.rank : null,
      status:        'Pending with Submitting Officer',
      stageKey:      'submitting',
      currentHolder: `Submitting Officer: ${subOfficer.name}`,
      finalMessage:  ''
    });
    if (attachments.length) application.attachments = (application.attachments || []).concat(attachments);
    application.history.push({
      by: currentUser.name, role: 'Employee',
      action: 'Resubmitted after correction',
      note: `Corrected and resubmitted: ${numDays} day(s) from ${fromDate} to ${toDate}. Reason: ${reason}`,
      time: now
    });

    addNotification(`${application.id} resubmitted and pending with ${subOfficer.name}.`, currentUser.kgid, 'Employee');
    saveDatabase();
    setMessage(`Resubmitted ${application.id} to ${subOfficer.name} successfully.`, 'success', applyResult);
    editingApplicationId = null;
    submitLeaveButton.innerHTML = '<span>🚀</span> Submit Leave Request';
  } else {
    // ---- FRESH APPLICATION ----
    const id = `PL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const routeNote = single
      ? `Applied for ${numDays} day(s) from ${fromDate} to ${toDate}. Route: ${subOfficer.name} (Single-stage sanction)`
      : `Applied for ${numDays} day(s) from ${fromDate} to ${toDate}. Route: ${subOfficer.name} → ${grantOfficer.name} → ${appOfficer.name}`;
    const application = {
      id, applicant: currentUser.name, kgid: currentUser.kgid,
      rank: currentUser.rank, workingPlace: currentUser.workingPlace || currentUser.district,
      type: leaveType, fromDate, toDate, numberOfDays: numDays, reason,
      singleStage: single,
      attachments,
      assignedSubmittingOfficerKgid:  subOfficer.kgid,
      assignedSubmittingOfficerName:  subOfficer.name,
      assignedSubmittingOfficerRank:  subOfficer.rank,
      assignedGrantingOfficerKgid:    grantOfficer ? grantOfficer.kgid : null,
      assignedGrantingOfficerName:    grantOfficer ? grantOfficer.name : null,
      assignedGrantingOfficerRank:    grantOfficer ? grantOfficer.rank : null,
      assignedApprovingOfficerKgid:   appOfficer ? appOfficer.kgid : null,
      assignedApprovingOfficerName:   appOfficer ? appOfficer.name : null,
      assignedApprovingOfficerRank:   appOfficer ? appOfficer.rank : null,
      status:        'Pending with Submitting Officer',
      stageKey:      'submitting',
      currentHolder: `Submitting Officer: ${subOfficer.name}`,
      finalMessage:  '',
      createdAt:     now,
      history: [{
        by: currentUser.name, role: 'Employee',
        action: 'Leave request submitted',
        note: routeNote,
        time: now
      }]
    };
    leaveApplications.unshift(application);
    addNotification(`${id} submitted. Pending with ${subOfficer.name}.`, currentUser.kgid, 'Employee');
    saveDatabase();
    setMessage(`Leave request ${id} submitted successfully to ${subOfficer.name}.`, 'success', applyResult);
  }

  $('apply-form').reset();
  leaveDaysInput.value = '';
  hideDaysPreview();
  const rp = $('routing-preview');
  if (rp) rp.classList.add('hidden');
  const fp = $('file-preview-list');
  if (fp) fp.innerHTML = '';
  renderTrackList();
}

// ============================================================
// STAGE TRACKER RENDERER
// ============================================================

function renderStageTracker(app) {
  const steps = app.singleStage
    ? [
        { key: 'employee',   label: 'Employee',          status: 'Draft / Correction',     icon: '👤' },
        { key: 'submitting', label: 'Submitting Officer', status: 'Pending with SO',        icon: '📋' },
        { key: 'final',      label: 'Sanctioned',         status: 'Sanctioned / Closed',    icon: '✅' }
      ]
    : WORKFLOW_STEPS;

  const currentIndex = steps.findIndex(s => s.key === app.stageKey);
  const isRejected   = app.status === 'Rejected';

  return `<div class="stage-track">${steps.map((step, idx) => {
    let cls = '';
    let circleContent = '';

    if (isRejected && idx === currentIndex) {
      cls = 'rejected';
      circleContent = '✕';
    } else if (idx < currentIndex) {
      cls = 'done';
      circleContent = '✓';
    } else if (idx === currentIndex) {
      cls = 'current';
      circleContent = step.icon;
    } else {
      circleContent = String(idx + 1);
    }

    let label = step.label;
    if (step.key === 'submitting' && app.assignedSubmittingOfficerName) label = app.assignedSubmittingOfficerName;
    if (step.key === 'granting'   && app.assignedGrantingOfficerName)   label = app.assignedGrantingOfficerName;
    if (step.key === 'approving'  && app.assignedApprovingOfficerName)  label = app.assignedApprovingOfficerName;

    const statusText = step.key === 'final' && isRejected ? 'Rejected' : step.status;

    return `<div class="stage ${cls}">
      <div class="stage-circle">${circleContent}</div>
      <strong>${escapeHtml(label)}</strong>
      <small>${escapeHtml(statusText)}</small>
    </div>`;
  }).join('')}</div>`;
}

// ============================================================
// TRACK / REQUEST STATUS VIEW
// ============================================================

function renderTrackList() {
  if (!trackList || !currentUser) return;

  const visible = currentRole === 'Employee'
    ? leaveApplications.filter(a => String(a.kgid) === currentUser.kgid)
    : leaveApplications;

  trackCount.textContent = `${visible.length} request${visible.length !== 1 ? 's' : ''}`;

  if (visible.length === 0) {
    trackList.innerHTML = `<div class="empty-state">
      <span class="empty-icon">📂</span>
      <strong>No leave requests found</strong>
      <p style="margin:6px 0 0;font-size:0.86rem;">Submit a leave request from the Apply Leave panel.</p>
    </div>`;
    return;
  }

  trackList.innerHTML = visible.map(app => {
    const isReturned = app.status.includes('Returned') || app.status === 'Returned for correction';
    const isSanctioned = app.status === 'Leave sanctioned';
    const isRejected   = app.status === 'Rejected';

    let borderColor = 'var(--blue)';
    if (isSanctioned) borderColor = 'var(--green)';
    else if (isRejected) borderColor = 'var(--red)';
    else if (isReturned) borderColor = 'var(--orange)';

    let statusClass = '';
    if (isSanctioned) statusClass = 'success';
    else if (isRejected) statusClass = 'danger';
    else if (isReturned) statusClass = 'warning';

    const attachmentHtml = (app.attachments || []).length
      ? app.attachments.map((f, i) => {
          const display  = escapeHtml(f.originalName || f.name);
          const pathAttr = f.path ? `data-path="${escapeHtml(f.path)}"` : '';
          const icon     = getFileTypeIconMarkup(f.name || '');
          return `<a href="#" class="attachment-link" ${pathAttr} data-id="${escapeHtml(app.id)}" data-index="${i}"
            style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;text-decoration:none;font-size:0.84rem;">
            ${icon}<span style="text-decoration:underline;color:var(--blue);">${display}</span></a>`;
        }).join('')
      : '<span style="color:var(--muted);font-size:0.84rem;">No attachments</span>';

    let currentLocation = app.currentHolder || app.status;
    if (app.stageKey === 'submitting' && app.assignedSubmittingOfficerName)
      currentLocation = `📋 Submitting Officer: ${app.assignedSubmittingOfficerName} (${app.assignedSubmittingOfficerRank || 'PI'})`;
    else if (app.stageKey === 'granting' && app.assignedGrantingOfficerName)
      currentLocation = `📝 Granting Officer: ${app.assignedGrantingOfficerName} (${app.assignedGrantingOfficerRank || 'DSP'})`;
    else if (app.stageKey === 'approving' && app.assignedApprovingOfficerName)
      currentLocation = `⚖️ Approving Officer: ${app.assignedApprovingOfficerName} (${app.assignedApprovingOfficerRank || 'SP'})`;

    const editBtn = (isReturned && currentRole === 'Employee')
      ? `<button class="small-button" style="background:var(--orange);color:#fff;margin-top:12px;" data-edit-id="${app.id}">
           ✏️ Edit & Resubmit
         </button>`
      : '';

    let finalBox = '';
    if (app.finalMessage) {
      const boxClass = isRejected ? 'reject-box' : 'sanction-box';
      const icon     = isRejected ? '❌' : '🎉';
      finalBox = `<div class="${boxClass}" style="margin-top:14px;">
        <span style="font-size:1.4rem;">${icon}</span>
        <span>${escapeHtml(app.finalMessage)}</span>
      </div>`;
    }

    const historyHtml = (app.history || []).map(h => `
      <li class="history-item">
        <span class="history-action">${escapeHtml(h.action)}</span>
        <span class="history-meta">By <strong>${escapeHtml(h.by)}</strong> · ${escapeHtml(h.role)} · ${escapeHtml(h.time)}</span>
        <p class="history-note">💬 Remarks: "${escapeHtml(h.note || 'No remarks.')}"</p>
      </li>`).join('');

    return `<article class="request-card" style="border-left: 5px solid ${borderColor};">
      <div class="request-top">
        <div>
          <span class="request-id">${escapeHtml(app.id)}</span>
          <h4 style="margin:6px 0 4px;">${escapeHtml(app.applicant)} &mdash; ${escapeHtml(app.type)}</h4>
          <p style="margin:0;color:var(--muted);font-size:0.86rem;">KGID: ${escapeHtml(app.kgid)} · ${escapeHtml(app.rank || '')} · Submitted: ${escapeHtml(app.createdAt || '')}</p>
        </div>
        <span class="status ${statusClass}">${escapeHtml(app.status)}</span>
      </div>

      ${renderStageTracker(app)}

      <div class="request-meta" style="margin-top:14px;">
        <div>
          <strong>Dates</strong>
          ${escapeHtml(app.fromDate)} → ${escapeHtml(app.toDate)} (${escapeHtml(String(app.numberOfDays))} day(s))
        </div>
        <div>
          <strong>Current Location</strong>
          ${escapeHtml(currentLocation)}
        </div>
        <div>
          <strong>Reason</strong>
          <em>"${escapeHtml(app.reason)}"</em>
        </div>
        <div>
          <strong>Attachments</strong>
          ${attachmentHtml}
        </div>
      </div>

      ${finalBox}
      ${editBtn}

      <details style="margin-top:16px;">
        <summary>📋 Show Full File Movement Timeline (${(app.history||[]).length} entries)</summary>
        <ol class="history" style="margin-top:12px;">${historyHtml}</ol>
      </details>
    </article>`;
  }).join('');
}

// Edit & Resubmit click handler
document.addEventListener('click', e => {
  const btn = e.target.closest('button[data-edit-id]');
  if (!btn) return;
  const app = leaveApplications.find(a => a.id === btn.getAttribute('data-edit-id'));
  if (!app) return;

  leaveTypeSelect.value           = app.type;
  fromDateInput.value             = app.fromDate;
  toDateInput.value               = app.toDate;
  applySubmittingSelect.value     = app.assignedSubmittingOfficerKgid || '';
  applyGrantingSelect.value       = app.assignedGrantingOfficerKgid   || '';
  applyApprovingSelect.value      = app.assignedApprovingOfficerKgid  || '';
  reasonInput.value               = app.reason;
  calculateDays();
  updateRoutingPreview();

  editingApplicationId = app.id;
  submitLeaveButton.innerHTML = `<span>🔁</span> Resubmit Leave Request [${app.id}]`;

  setMessage(`Loaded ${app.id} for correction. Edit details and click Resubmit.`, 'success', applyResult);
  showView('apply');
});

// Attachment click handler
document.addEventListener('click', e => {
  const a = e.target.closest('.attachment-link');
  if (!a) return;
  e.preventDefault();
  const filePath = a.getAttribute('data-path');
  if (!filePath) { alert('File path not available.'); return; }
  const res = window.api.openAttachment(filePath);
  if (!res || !res.success) alert(`Could not open: ${res && res.error ? res.error : 'Unknown error'}`);
});

// ============================================================
// OFFICER INBOX
// ============================================================

function getInboxStatus(role) {
  if (role === 'Submitting Officer') return 'Pending with Submitting Officer';
  if (role === 'Granting Officer')   return 'Pending with Granting Officer';
  if (role === 'Approving Officer')  return 'Pending with Approving Officer';
  return null;
}

function renderInbox() {
  if (!inboxTableBody || !currentUser) return;

  const status = getInboxStatus(currentRole);
  if (!status) {
    inboxCount.textContent = 'Employee';
    inboxTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);">
      Officer Inbox is only available for Submitting, Granting, and Approving Officers.
    </td></tr>`;
    return;
  }

  const pending = leaveApplications.filter(app => {
    if (app.status !== status) return false;
    if (currentRole === 'Submitting Officer')
      return !app.assignedSubmittingOfficerKgid || app.assignedSubmittingOfficerKgid === currentUser.kgid;
    if (currentRole === 'Granting Officer')
      return !app.assignedGrantingOfficerKgid   || app.assignedGrantingOfficerKgid   === currentUser.kgid;
    if (currentRole === 'Approving Officer')
      return !app.assignedApprovingOfficerKgid  || app.assignedApprovingOfficerKgid  === currentUser.kgid;
    return true;
  });

  inboxCount.textContent = `${pending.length} pending`;

  if (pending.length === 0) {
    inboxTableBody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state" style="border:none;padding:32px;">
        <span class="empty-icon">📭</span>
        <strong>Inbox is clear</strong>
        <p style="margin:6px 0 0;font-size:0.86rem;">No leave files are currently pending in your tray.</p>
      </div>
    </td></tr>`;
    return;
  }

  inboxTableBody.innerHTML = pending.map(app => {
    let actionButtons = '';

    if (currentRole === 'Submitting Officer') {
      if (app.singleStage) {
        // Single-stage: SO sanctions directly
        actionButtons = `
          <div style="font-size:0.76rem;background:var(--surface-green);color:#166534;padding:4px 8px;border-radius:4px;margin-bottom:6px;">
            ⚡ Single-stage — Direct Sanction (${escapeHtml(app.type)})
          </div>
          <button class="small-button" data-action="so-sanction" data-id="${app.id}" style="background:var(--green);color:#fff;">🏅 Sanction Leave</button>
          <button class="small-button secondary" data-action="return-employee" data-id="${app.id}">↩ Return to Employee</button>`;
      } else {
        actionButtons = `
          <button class="small-button" data-action="forward" data-id="${app.id}" style="background:var(--blue);color:#fff;">📤 Forward</button>
          <button class="small-button secondary" data-action="return-employee" data-id="${app.id}">↩ Return to Employee</button>`;
      }
    } else if (currentRole === 'Granting Officer') {
      actionButtons = `
        <button class="small-button" data-action="recommend" data-id="${app.id}" style="background:var(--orange);color:#fff;">✅ Recommend</button>
        <button class="small-button secondary" data-action="return-submitting" data-id="${app.id}">↩ Return to SO</button>
        <button class="small-button secondary" data-action="return-employee" data-id="${app.id}">↩ Return to Employee</button>`;
    } else if (currentRole === 'Approving Officer') {
      // Approving Officer: only Sanction or Reject — no return stages
      actionButtons = `
        <button class="small-button" data-action="approve" data-id="${app.id}" style="background:var(--green);color:#fff;">🏅 Sanction Leave</button>
        <button class="small-button" data-action="reject" data-id="${app.id}" style="background:var(--red);color:#fff;">✕ Reject</button>`;
    }

    const fileBadges = (app.attachments || []).map(f => getFileTypeIconMarkup(f.name || '')).join(' ') ||
      '<span style="color:var(--muted);font-size:0.76rem;">No files</span>';

    return `<tr>
      <td>
        <span style="font-family:monospace;font-weight:900;color:var(--blue);font-size:0.88rem;">${escapeHtml(app.id)}</span><br>
        <span style="font-size:0.76rem;color:var(--muted);">${escapeHtml(app.createdAt || '')}</span>
      </td>
      <td>
        <strong>${escapeHtml(app.applicant)}</strong><br>
        <span style="font-size:0.82rem;color:var(--muted);">${escapeHtml(app.rank || '')} · KGID: ${escapeHtml(app.kgid)}</span><br>
        <span style="font-size:0.8rem;color:var(--muted);">📍 ${escapeHtml(app.workingPlace || 'Wireless HQ')}</span>
      </td>
      <td>
        <strong>${escapeHtml(app.type)}</strong><br>
        <span style="font-size:0.82rem;color:var(--muted);">${escapeHtml(String(app.numberOfDays))} days</span><br>
        <em style="font-size:0.82rem;color:var(--text-secondary);">"${escapeHtml(app.reason)}"</em>
      </td>
      <td style="font-size:0.86rem;font-weight:700;white-space:nowrap;">
        📅 ${escapeHtml(app.fromDate)}<br>to ${escapeHtml(app.toDate)}
      </td>
      <td>
        <span class="status" style="background:var(--surface-orange);color:#92400e;">Pending</span><br>
        <div style="margin-top:8px;">${fileBadges}</div>
      </td>
      <td>
        <textarea id="remarks-${escapeHtml(app.id)}" class="remarks-input"
          placeholder="Enter remarks or clarification notes (required for return/reject)..."></textarea>
        <div class="action-buttons-wrap">${actionButtons}</div>
      </td>
    </tr>`;
  }).join('');
}

// Inbox action handler
inboxTableBody && inboxTableBody.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (btn) performInboxAction(btn.dataset.id, btn.dataset.action);
});

function performInboxAction(applicationId, action) {
  const app = leaveApplications.find(a => a.id === applicationId);
  if (!app) return;

  const remarksEl = $(`remarks-${app.id}`);
  const remarks   = remarksEl ? remarksEl.value.trim() : '';

  if ((action.startsWith('return') || action === 'reject') && !remarks) {
    alert('Please enter remarks or reasons in the Remarks box before returning or rejecting.');
    return;
  }

  const CONFIRM_MSGS = {
    forward:          `Forward leave file ${app.id} to Granting Officer ${app.assignedGrantingOfficerName}?`,
    recommend:        `Recommend leave file ${app.id} to Approving Officer ${app.assignedApprovingOfficerName}?`,
    approve:          `SANCTION leave ${app.id} for ${app.numberOfDays} day(s)? This cannot be undone.`,
    'so-sanction':    `SANCTION leave ${app.id} for ${app.numberOfDays} day(s) directly? (Single-stage ${app.type})`,
    reject:           `REJECT leave application ${app.id}?`,
    'return-employee':  `Return file ${app.id} to Employee ${app.applicant} for correction?`,
    'return-submitting': `Return file ${app.id} to Submitting Officer ${app.assignedSubmittingOfficerName}?`,
    'return-granting':   `Return file ${app.id} to Granting Officer ${app.assignedGrantingOfficerName}?`
  };
  if (CONFIRM_MSGS[action] && !confirm(CONFIRM_MSGS[action])) return;

  const now    = new Date().toLocaleString();
  const actor  = currentUser.name;
  const note   = remarks || 'Approved and forwarded.';

  const TRANSITIONS = {
    forward: {
      status:        'Pending with Granting Officer',
      stageKey:      'granting',
      currentHolder: `Granting Officer: ${app.assignedGrantingOfficerName}`,
      actionText:    'Forwarded by Submitting Officer',
      note
    },
    'so-sanction': {
      status:        'Leave sanctioned',
      stageKey:      'final',
      currentHolder: 'Closed (Sanctioned)',
      actionText:    `Leave Sanctioned by Submitting Officer (Single-stage — ${app.type})`,
      note,
      finalMessage:  `✅ Your ${app.type} is sanctioned for ${app.fromDate} to ${app.toDate} (${app.numberOfDays} day(s)). Sanctioned by ${actor}.`
    },
    recommend: {
      status:        'Pending with Approving Officer',
      stageKey:      'approving',
      currentHolder: `Approving Officer: ${app.assignedApprovingOfficerName}`,
      actionText:    'Recommended by Granting Officer',
      note
    },
    approve: {
      status:        'Leave sanctioned',
      stageKey:      'final',
      currentHolder: 'Closed (Sanctioned)',
      actionText:    'Leave Sanctioned by Approving Officer',
      note,
      finalMessage:  `✅ Your leave is sanctioned for the applying dates and number of days: ${app.fromDate} to ${app.toDate} (${app.numberOfDays} day(s)). Sanctioned by ${actor}.`
    },
    reject: {
      status:        'Rejected',
      stageKey:      'final',
      currentHolder: 'Closed (Rejected)',
      actionText:    'Rejected by Approving Officer',
      note,
      finalMessage:  `❌ Your leave application (${app.id}) was rejected. Remarks: ${note}`
    },
    'return-employee': {
      status:        'Returned for correction',
      stageKey:      'employee',
      currentHolder: `Employee: ${app.applicant} (Correction Pending)`,
      actionText:    `Returned to Employee by ${currentRole}`,
      note
    },
    'return-submitting': {
      status:        'Pending with Submitting Officer',
      stageKey:      'submitting',
      currentHolder: `Submitting Officer: ${app.assignedSubmittingOfficerName}`,
      actionText:    `Returned to Submitting Officer by ${currentRole}`,
      note
    },
    'return-granting': {
      status:        'Pending with Granting Officer',
      stageKey:      'granting',
      currentHolder: `Granting Officer: ${app.assignedGrantingOfficerName}`,
      actionText:    `Returned to Granting Officer by ${currentRole}`,
      note
    }
  };

  const update = TRANSITIONS[action];
  if (!update) return;

  app.status        = update.status;
  app.stageKey      = update.stageKey;
  app.currentHolder = update.currentHolder;
  if (update.finalMessage) app.finalMessage = update.finalMessage;

  app.history = app.history || [];
  app.history.push({ by: actor, role: currentRole, action: update.actionText, note: update.note, time: now });

  addNotification(`File ${app.id}: ${update.actionText} → Status: ${app.status}`, app.kgid, currentRole);
  saveDatabase();
  renderInbox();
}

// ============================================================
// REPORTS PANEL
// ============================================================

function parseAppDate(createdAt) {
  if (!createdAt) return null;
  // Format: "22/05/2026, 12:50:34"
  const parts = String(createdAt).split(',')[0].split('/');
  if (parts.length === 3) {
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  }
  return new Date(createdAt);
}

function renderReports() {
  const container = $('reports-content');
  if (!container) return;

  const monthSel = $('report-month-sel');
  const yearSel  = $('report-year-sel');
  const now      = new Date();
  const selMonth = monthSel ? parseInt(monthSel.value) : now.getMonth();
  const selYear  = yearSel  ? parseInt(yearSel.value)  : now.getFullYear();

  const MONTH_NAMES = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];

  // ── Filter: applications created in selected month ──
  const monthApps = leaveApplications.filter(a => {
    const d = parseAppDate(a.createdAt);
    return d && d.getMonth() === selMonth && d.getFullYear() === selYear;
  });

  const total = monthApps.length;
  const sanctioned = monthApps.filter(a => a.status === 'Leave sanctioned').length;
  const pending    = monthApps.filter(a => !['Leave sanctioned','Rejected'].includes(a.status)).length;
  const rejected   = monthApps.filter(a => a.status === 'Rejected').length;

  // ── By leave type ──
  const byType = {};
  monthApps.forEach(a => {
    if (!byType[a.type]) byType[a.type] = { count: 0, days: 0 };
    byType[a.type].count++;
    byType[a.type].days += (parseInt(a.numberOfDays) || 0);
  });

  // ── Long leaves (> 15 days) ──
  const longLeaves = monthApps.filter(a => (parseInt(a.numberOfDays) || 0) > 15);

  // ── Earned Leave individual count (ALL TIME) ──
  const elApps = leaveApplications.filter(a => a.type === 'Earned Leave');
  const elByPerson = {};
  elApps.forEach(a => {
    const k = a.kgid;
    if (!elByPerson[k]) elByPerson[k] = { name: a.applicant, rank: a.rank || '', count: 0, days: 0, sanctioned: 0 };
    elByPerson[k].count++;
    elByPerson[k].days += (parseInt(a.numberOfDays) || 0);
    if (a.status === 'Leave sanctioned') elByPerson[k].sanctioned++;
  });
  const elRows = Object.values(elByPerson).sort((a, b) => b.count - a.count);

  // ── Paternity Leave tracker (ALL TIME) ──
  const patApps = leaveApplications.filter(a => a.type === 'Paternity Leave');
  const patByPerson = {};
  patApps.forEach(a => {
    const k = a.kgid;
    if (!patByPerson[k]) patByPerson[k] = { name: a.applicant, rank: a.rank || '', sanctioned: 0, pending: 0, total: 0 };
    patByPerson[k].total++;
    if (a.status === 'Leave sanctioned') patByPerson[k].sanctioned++;
    else if (!['Rejected'].includes(a.status)) patByPerson[k].pending++;
  });
  const patRows = Object.values(patByPerson).sort((a, b) => b.total - a.total);

  // ── Leave type breakdown rows HTML ──
  const typeRowsHtml = Object.entries(byType).length
    ? Object.entries(byType)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([type, info]) => {
          const lt = LEAVE_TYPES.find(l => l.name === type);
          const icon = lt ? lt.icon : '📄';
          const badge = lt && lt.singleStage
            ? '<span style="font-size:0.7rem;background:#d1fae5;color:#065f46;padding:1px 5px;border-radius:3px;margin-left:4px;">Single-stage</span>'
            : '';
          return `<tr>
            <td>${icon} ${escapeHtml(type)}${badge}</td>
            <td style="text-align:center;font-weight:700;">${info.count}</td>
            <td style="text-align:center;">${info.days}</td>
          </tr>`;
        }).join('')
    : `<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:18px;">No leave applications in this period.</td></tr>`;

  // ── Long leaves HTML ──
  const longHtml = longLeaves.length
    ? longLeaves.map(a => `<tr>
        <td><span style="font-family:monospace;font-size:0.82rem;color:var(--blue);">${escapeHtml(a.id)}</span></td>
        <td>${escapeHtml(a.applicant)}<br><span style="font-size:0.76rem;color:var(--muted);">${escapeHtml(a.rank||'')} · KGID ${escapeHtml(a.kgid)}</span></td>
        <td>${escapeHtml(a.type)}</td>
        <td style="text-align:center;font-weight:700;color:var(--red);">${a.numberOfDays} days</td>
        <td>${escapeHtml(a.fromDate)} → ${escapeHtml(a.toDate)}</td>
        <td><span class="status ${a.status==='Leave sanctioned'?'success':a.status==='Rejected'?'danger':''}">${escapeHtml(a.status)}</span></td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:16px;">No long-duration leaves (>15 days) this month.</td></tr>`;

  // ── EL individual table ──
  const elHtml = elRows.length
    ? elRows.map(r => {
        const remaining = Math.max(0, 2 - r.sanctioned);
        const bar = `<div style="display:flex;align-items:center;gap:6px;">
          <div style="background:#e2e8f0;border-radius:4px;width:80px;height:8px;overflow:hidden;">
            <div style="background:var(--green);width:${Math.min(100, (r.sanctioned/Math.max(r.count,1))*100)}%;height:100%;"></div>
          </div>
          <span style="font-size:0.74rem;color:var(--muted);">${r.sanctioned} sanctioned</span>
        </div>`;
        return `<tr>
          <td>${escapeHtml(r.name)}<br><span style="font-size:0.76rem;color:var(--muted);">${escapeHtml(r.rank)}</span></td>
          <td style="text-align:center;font-weight:700;">${r.count}</td>
          <td style="text-align:center;">${r.days}</td>
          <td>${bar}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px;">No Earned Leave applications found.</td></tr>`;

  // ── Paternity Leave table ──
  const patHtml = patRows.length
    ? patRows.map(r => {
        const remaining = 2 - r.sanctioned;
        const statusEl = remaining <= 0
          ? `<span style="color:var(--red);font-weight:700;">❌ Exhausted (2/2)</span>`
          : `<span style="color:var(--green);font-weight:700;">${remaining} remaining</span>`;
        return `<tr>
          <td>${escapeHtml(r.name)}<br><span style="font-size:0.76rem;color:var(--muted);">${escapeHtml(r.rank)}</span></td>
          <td style="text-align:center;">${r.total}</td>
          <td style="text-align:center;font-weight:700;">${r.sanctioned} / 2</td>
          <td style="text-align:center;">${r.pending}</td>
          <td>${statusEl}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:16px;">No Paternity Leave records found.</td></tr>`;

  container.innerHTML = `
    <!-- Summary Metrics -->
    <div class="summary-grid" style="margin-bottom:20px;">
      <article class="metric metric-blue">
        <span class="metric-icon">📋</span>
        <span class="metric-label">Total Applications</span>
        <strong>${total}</strong>
      </article>
      <article class="metric metric-green">
        <span class="metric-icon">✅</span>
        <span class="metric-label">Sanctioned</span>
        <strong>${sanctioned}</strong>
      </article>
      <article class="metric metric-orange">
        <span class="metric-icon">⏳</span>
        <span class="metric-label">Pending</span>
        <strong>${pending}</strong>
      </article>
      <article class="metric metric-purple">
        <span class="metric-icon">❌</span>
        <span class="metric-label">Rejected</span>
        <strong>${rejected}</strong>
      </article>
    </div>

    <!-- Leave Type Breakdown -->
    <div class="form-section" style="margin-bottom:20px;">
      <div class="form-section-title">📊 Leave Type Breakdown — ${MONTH_NAMES[selMonth]} ${selYear}</div>
      <div class="table-container">
        <table>
          <thead><tr><th>Leave Type</th><th style="text-align:center;">Applications</th><th style="text-align:center;">Total Days</th></tr></thead>
          <tbody>${typeRowsHtml}</tbody>
        </table>
      </div>
    </div>

    <!-- Long Duration Leaves -->
    <div class="form-section" style="margin-bottom:20px;">
      <div class="form-section-title">📅 Long Duration Leaves (more than 15 days) — ${MONTH_NAMES[selMonth]} ${selYear}</div>
      <div class="table-container">
        <table>
          <thead><tr><th>File ID</th><th>Applicant</th><th>Type</th><th style="text-align:center;">Days</th><th>Period</th><th>Status</th></tr></thead>
          <tbody>${longHtml}</tbody>
        </table>
      </div>
    </div>

    <!-- Earned Leave Individual Count (All Time) -->
    <div class="form-section" style="margin-bottom:20px;">
      <div class="form-section-title">🌿 Earned Leave — Individual Usage (All Time)</div>
      <div class="table-container">
        <table>
          <thead><tr><th>Employee</th><th style="text-align:center;">Times Applied</th><th style="text-align:center;">Total Days</th><th>Progress</th></tr></thead>
          <tbody>${elHtml}</tbody>
        </table>
      </div>
    </div>

    <!-- Paternity Leave Tracker (All Time) -->
    <div class="form-section">
      <div class="form-section-title">👨‍👩‍👧 Paternity Leave Tracker — Service Life (Max 2 times)</div>
      <div class="table-container">
        <table>
          <thead><tr><th>Employee</th><th style="text-align:center;">Total Applied</th><th style="text-align:center;">Sanctioned</th><th style="text-align:center;">Pending</th><th>Entitlement</th></tr></thead>
          <tbody>${patHtml}</tbody>
        </table>
      </div>
      <p style="font-size:0.82rem;color:var(--muted);margin-top:8px;">⚠️ As per Karnataka Civil Services Rules, Paternity Leave is admissible only twice in an employee's entire service career.</p>
    </div>
  `;
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function renderNotifications() {
  if (!notificationList || !currentUser) return;

  const visible = notifications.filter(n => {
    if (!n.kgid && !n.role) return true;
    if (currentRole === 'Employee') return n.kgid === currentUser.kgid || n.role === 'Employee';
    return n.role === currentRole || n.kgid === currentUser.kgid;
  });

  if (visible.length === 0) {
    notificationList.innerHTML = `<div class="empty-state">
      <span class="empty-icon">🔔</span>
      <strong>No notifications yet</strong>
      <p style="margin:6px 0 0;font-size:0.86rem;">System alerts and leave file movements will appear here.</p>
    </div>`;
    return;
  }

  notificationList.innerHTML = visible.slice(0, 50).map(n => `
    <div class="notification-item">
      <span class="notif-icon">📣</span>
      <div>
        <span class="notif-text">${escapeHtml(n.text)}</span>
        <span class="notif-time">🕐 ${escapeHtml(n.time)}</span>
      </div>
    </div>`).join('');
}

// ============================================================
// DEMO SEED DATA
// ============================================================

function seedDemoData() {
  if (!employees || employees.length === 0) return;

  const regEmps  = employees.filter(e => !isPotentialApprovingOfficer(e) && !isPotentialGrantingOfficer(e)).slice(5, 8);
  const subList  = employees.filter(isPotentialSubmittingOfficer).slice(0, 2);
  const grantList = employees.filter(isPotentialGrantingOfficer).slice(0, 2);
  const appList  = employees.filter(isPotentialApprovingOfficer).slice(0, 2);

  if (regEmps.length < 2 || !subList[0] || !grantList[0] || !appList[0]) return;

  const now = new Date().toLocaleString();
  const d   = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

  leaveApplications = [
    {
      id: 'PL-DEMO-001', applicant: regEmps[0].name, kgid: regEmps[0].kgid,
      rank: regEmps[0].rank, workingPlace: regEmps[0].workingPlace || regEmps[0].district,
      type: 'Casual Leave', fromDate: d(-2), toDate: d(1), numberOfDays: 4,
      reason: 'Urgent domestic repair work at native hometown. Requires personal presence.',
      attachments: [],
      assignedSubmittingOfficerKgid: subList[0].kgid, assignedSubmittingOfficerName: subList[0].name, assignedSubmittingOfficerRank: subList[0].rank,
      assignedGrantingOfficerKgid:   grantList[0].kgid, assignedGrantingOfficerName: grantList[0].name, assignedGrantingOfficerRank: grantList[0].rank,
      assignedApprovingOfficerKgid:  appList[0].kgid, assignedApprovingOfficerName: appList[0].name, assignedApprovingOfficerRank: appList[0].rank,
      status: 'Pending with Submitting Officer', stageKey: 'submitting',
      currentHolder: `Submitting Officer: ${subList[0].name}`, finalMessage: '', createdAt: now,
      history: [{ by: regEmps[0].name, role: 'Employee', action: 'Leave request submitted', note: `4 days Casual Leave. Route: ${subList[0].name} → ${grantList[0].name} → ${appList[0].name}`, time: now }]
    },
    {
      id: 'PL-DEMO-002', applicant: regEmps.length > 1 ? regEmps[1].name : regEmps[0].name,
      kgid: regEmps.length > 1 ? regEmps[1].kgid : regEmps[0].kgid,
      rank: regEmps.length > 1 ? regEmps[1].rank : regEmps[0].rank,
      workingPlace: (regEmps.length > 1 ? regEmps[1] : regEmps[0]).workingPlace || 'Wireless HQ',
      type: 'Medical Leave', fromDate: d(-5), toDate: d(5), numberOfDays: 11,
      reason: 'Medical rest advised by authorised physician due to severe viral fever.',
      attachments: [],
      assignedSubmittingOfficerKgid: subList[0].kgid, assignedSubmittingOfficerName: subList[0].name, assignedSubmittingOfficerRank: subList[0].rank,
      assignedGrantingOfficerKgid:   grantList[0].kgid, assignedGrantingOfficerName: grantList[0].name, assignedGrantingOfficerRank: grantList[0].rank,
      assignedApprovingOfficerKgid:  appList[0].kgid, assignedApprovingOfficerName: appList[0].name, assignedApprovingOfficerRank: appList[0].rank,
      status: 'Pending with Granting Officer', stageKey: 'granting',
      currentHolder: `Granting Officer: ${grantList[0].name}`, finalMessage: '', createdAt: now,
      history: [
        { by: regEmps.length > 1 ? regEmps[1].name : regEmps[0].name, role: 'Employee', action: 'Leave request submitted', note: '11 days Medical Leave.', time: now },
        { by: subList[0].name, role: 'Submitting Officer', action: 'Forwarded by Submitting Officer', note: 'Medical certificate verified and attached. Recommending forward.', time: now }
      ]
    }
  ];

  saveDatabase();
}

// ============================================================
// FILE PREVIEW (apply panel)
// ============================================================

function setupFilePreview() {
  if (!attachmentsInput) return;
  attachmentsInput.addEventListener('change', () => {
    const listEl = $('file-preview-list');
    if (!listEl) return;
    listEl.innerHTML = Array.from(attachmentsInput.files).map(f => {
      const icon = getFileTypeIconMarkup(f.name);
      const size = f.size > 1024 * 1024
        ? `${(f.size / 1048576).toFixed(1)} MB`
        : `${Math.round(f.size / 1024)} KB`;
      return `<div class="file-badge">${icon}<span>${escapeHtml(f.name)}</span><span style="color:var(--muted);font-size:0.74rem;">${size}</span></div>`;
    }).join('');
  });
}

// ============================================================
// INIT
// ============================================================

function init() {
  loadData();
  try {
    console.info('INIT:', JSON.stringify({ apiAvailable: !!window.api, employeeCount: (employees||[]).length }));
  } catch (e) {
    console.info('INIT: could not stringify init info', { apiAvailable: !!window.api, employeeCount: (employees||[]).length });
  }
  renderRoleOptions();
  renderEmployeeDropdowns();
  renderLeaveTypes();

  if (!leaveApplications || leaveApplications.length === 0) seedDemoData();

  // Date change listeners
  fromDateInput && fromDateInput.addEventListener('change', calculateDays);
  toDateInput   && toDateInput.addEventListener('change', calculateDays);

  // Leave type change → toggle officer rows for single-stage
  leaveTypeSelect && leaveTypeSelect.addEventListener('change', handleLeaveTypeChange);

  // Routing preview
  applySubmittingSelect && applySubmittingSelect.addEventListener('change', updateRoutingPreview);
  applyGrantingSelect   && applyGrantingSelect.addEventListener('change', updateRoutingPreview);
  applyApprovingSelect  && applyApprovingSelect.addEventListener('change', updateRoutingPreview);

  // Nav
  navButtons.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

  // Login
  loginButton  && loginButton.addEventListener('click', sendOtp);
  verifyButton && verifyButton.addEventListener('click', verifyOtp);
  logoutButton && logoutButton.addEventListener('click', logout);

  // Submit leave
  submitLeaveButton && submitLeaveButton.addEventListener('click', createLeaveApplication);

  // File preview
  setupFilePreview();

  // Role change handler
  if (roleSelect) {
    roleSelect.addEventListener('change', () => {
      currentRole = roleSelect.value;
      [employeeSelectRow, submittingSelectRow, grantingSelectRow, approvingSelectRow].forEach(r => r && r.classList.add('hidden'));
      [kgidInput, mobileInput].forEach(el => { if (el) el.value = ''; });
      if (otpSection) otpSection.classList.add('hidden');
      if (otpInput)   otpInput.value = '';
      setMessage('', 'success');

      const MAP = {
        'Employee':           employeeSelectRow,
        'Submitting Officer': submittingSelectRow,
        'Granting Officer':   grantingSelectRow,
        'Approving Officer':  approvingSelectRow
      };
      const row = MAP[currentRole];
      if (row) row.classList.remove('hidden');
    });
  }

  // Auto-fill KGID from dropdowns
  const dropdowns = { employeeSelect, submittingSelect, grantingSelect, approvingSelect };
  Object.values(dropdowns).forEach(sel => {
    sel && sel.addEventListener('change', () => selectEmployeeByKgid(sel.value));
  });

  // Report filter dropdowns
  const reportMonthSel = $('report-month-sel');
  const reportYearSel  = $('report-year-sel');
  if (reportMonthSel) reportMonthSel.addEventListener('change', renderReports);
  if (reportYearSel)  reportYearSel.addEventListener('change', renderReports);

  // OTP: press Enter in OTP box
  otpInput && otpInput.addEventListener('keydown', e => { if (e.key === 'Enter') verifyOtp(); });
}

init();
