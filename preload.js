const { contextBridge } = require('electron');
const fs = require('fs');
const path = require('path');

const makePath = (name) => path.join(__dirname, name);

function safeReadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const txt = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return txt ? JSON.parse(txt) : [];
  } catch (e) {
    console.error('safeReadJSON error for', filePath, e);
    return [];
  }
}

function safeWriteJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('safeWriteJSON error for', filePath, e);
    return false;
  }
}

contextBridge.exposeInMainWorld('api', {
  loadEmployees: () => {
    const hrmsEmployees = safeReadJSON(makePath('hrms_employees.json'));
    if (Array.isArray(hrmsEmployees) && hrmsEmployees.length > 0) {
      return hrmsEmployees;
    }
    return safeReadJSON(makePath('employees.json'));
  },
  loadLeaveApplications: () => safeReadJSON(makePath('leave_applications.json')),
  saveLeaveApplications: (data) => safeWriteJSON(makePath('leave_applications.json'), data),
  loadNotifications: () => safeReadJSON(makePath('notifications.json')),
  saveNotifications: (data) => safeWriteJSON(makePath('notifications.json'), data),
  loadDocuments: () => safeReadJSON(makePath('documents.json')),
  saveDocuments: (data) => safeWriteJSON(makePath('documents.json'), data),
  saveAttachment: (srcPath) => {
    try {
      if (!srcPath) return { success: false, error: 'No source path' };
      const uploadsDir = makePath('uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
      const base = path.basename(srcPath);
      const name = `${Date.now()}_${base}`;
      const dest = path.join(uploadsDir, name);
      fs.copyFileSync(srcPath, dest);
      return { success: true, name, path: dest };
    } catch (e) {
      console.error('saveAttachment error', e);
      return { success: false, error: String(e) };
    }
  }
  ,
  openAttachment: (filePath) => {
    try {
      const { shell } = require('electron');
      if (!filePath || !require('fs').existsSync(filePath)) return { success: false, error: 'not_found' };
      shell.openPath(filePath);
      return { success: true };
    } catch (e) {
      console.error('openAttachment error', e);
      return { success: false, error: String(e) };
    }
  }
});
