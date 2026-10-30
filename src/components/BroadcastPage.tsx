import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student, ClassSubject, AssignmentGroup, ClassReminder, GmailConfig, SubjectMaterial } from '../types';
import { sortStudentsByLast4Digits, loadGmailConfig, saveGmailConfig } from '../utils/storage';
import { 
  Mail, 
  Send, 
  Users, 
  User, 
  Copy, 
  Check, 
  ExternalLink, 
  Key, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  Info, 
  X, 
  Eye, 
  Calendar, 
  MapPin, 
  Paperclip,
  FileText,
  UploadCloud,
  FileSpreadsheet,
  FileCheck,
  Zap,
  Layout,
  AlignLeft,
  BookOpen
} from 'lucide-react';

interface AttachedFile {
  id: string;
  filename: string;
  size: number;
  dataUri: string;
  contentType: string;
}

interface BroadcastPageProps {
  students: Student[];
  classes: ClassSubject[];
  groups: AssignmentGroup[];
  reminders: ClassReminder[];
  materials?: SubjectMaterial[];
  activeClassId: string;
}

export const BroadcastPage: React.FC<BroadcastPageProps> = ({
  students,
  classes,
  groups,
  reminders: _reminders,
  materials = [],
  activeClassId
}) => {
  const sortedStudents = useMemo(() => sortStudentsByLast4Digits(students), [students]);

  // Selected Subject for class context
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(activeClassId || (classes[0]?.id || ''));
  const activeSubject = classes.find(c => c.id === selectedSubjectId) || classes[0] || {
    id: 'cls-default',
    name: 'Class Subject',
    code: 'CS101',
    teacherName: 'Faculty Incharge',
    room: 'Main Lecture Hall',
    color: '#2563eb'
  };

  // Gmail Configuration State
  const [gmailConfig, setGmailConfig] = useState<GmailConfig>(loadGmailConfig());
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [tempGmailUser, setTempGmailUser] = useState(gmailConfig.email || 'businessofficial1590@gmail.com');
  const [tempAppPassword, setTempAppPassword] = useState(gmailConfig.appPassword || '');
  const [tempSenderName, setTempSenderName] = useState(gmailConfig.senderName || 'Class Representative (CR)');
  const [isVerifyingGmail, setIsVerifyingGmail] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  // Email Format Style: 'designed' (Rich Academic Card) vs 'simple' (Heading & Content Below)
  const [formatStyle, setFormatStyle] = useState<'designed' | 'simple'>('designed');

  // Notice Heading & Fields
  const [noticeHeading, setNoticeHeading] = useState('Important Class Announcement & Guidelines');
  const [senderDesk, setSenderDesk] = useState(gmailConfig.senderName || 'CR - Woxsen University');
  const [emailSubject, setEmailSubject] = useState(`[Notice] ${activeSubject.name} (${activeSubject.code}) - Class Update`);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [customVenue, setCustomVenue] = useState(activeSubject.room || 'Lecture Hall');

  // Editable Body Content
  const [emailBody, setEmailBody] = useState(
    `Dear {{STUDENT_NAME}},\n\nPlease note the upcoming schedule and study requirements for {{SUBJECT_NAME}} ({{SUBJECT_CODE}}).\n\nFaculty Incharge: {{FACULTY}}\nVenue / Classroom: {{VENUE}}\n\nPlease review the attached document and ensure all preparation is completed on time.\n\nBest regards,\n{{CR_NAME}}`
  );

  // Document Attachments
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isPickingPortalMaterial, setIsPickingPortalMaterial] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email Dispatch Status
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [sendingStudentId, setSendingStudentId] = useState<string | null>(null);
  const [sentStudentIds, setSentStudentIds] = useState<Set<string>>(new Set());

  // Copy feedback
  const [copiedWhatsAppWhole, setCopiedWhatsAppWhole] = useState(false);
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);

  // Preview Student (for live tag interpolation)
  const [previewStudentId, setPreviewStudentId] = useState<string>(sortedStudents[0]?.id || '');
  const previewStudent = sortedStudents.find(s => s.id === previewStudentId) || sortedStudents[0] || {
    id: 'std-sample',
    name: 'Rahul Sharma',
    rollNo: '23010103236',
    last4Digits: '3236',
    email: 'rahul.sharma@woxsen.edu.in'
  };

  // Rate Strategy
  const [rateStrategy, setRateStrategy] = useState<'instant' | '1.5s' | '3.0s' | '5.0s'>('instant');

  // Search filter for 1-to-1 table
  const [searchQuery, setSearchQuery] = useState('');

  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync senderDesk when config updates
  useEffect(() => {
    if (gmailConfig.senderName) {
      setSenderDesk(gmailConfig.senderName);
    }
  }, [gmailConfig.senderName]);

  // Update venue and subject when class changes
  useEffect(() => {
    if (activeSubject) {
      setCustomVenue(activeSubject.room || 'Lecture Hall');
      setEmailSubject(`[Notice] ${activeSubject.name} (${activeSubject.code}) - Class Announcement`);
    }
  }, [activeSubject?.id]);

  // Tag interpolation function
  const renderTemplateForStudent = (template: string, student: Student) => {
    const stGroup = groups.find(g => g.subjectId === selectedSubjectId && g.memberStudentIds.includes(student.id));
    const groupText = stGroup 
      ? `Group #${stGroup.groupNumber} (${stGroup.groupName}${stGroup.topic ? ` - ${stGroup.topic}` : ''})`
      : 'Unassigned Group';

    return template
      .replace(/{{STUDENT_NAME}}/g, student.name)
      .replace(/{{LAST_4}}/g, student.last4Digits || student.rollNo.slice(-4) || '----')
      .replace(/{{ROLL_NO}}/g, student.rollNo)
      .replace(/{{SUBJECT_NAME}}/g, activeSubject?.name || 'Class Subject')
      .replace(/{{SUBJECT_CODE}}/g, activeSubject?.code || 'CS101')
      .replace(/{{FACULTY}}/g, activeSubject?.teacherName || 'Faculty Incharge')
      .replace(/{{VENUE}}/g, customVenue || activeSubject?.room || 'Lecture Hall')
      .replace(/{{DATE}}/g, customDate || 'Regular Schedule')
      .replace(/{{TIME}}/g, customTime || 'Class Timing')
      .replace(/{{GROUP_INFO}}/g, groupText)
      .replace(/{{CR_NAME}}/g, senderDesk || 'Class Representative (CR)');
  };

  // Live rendered preview values
  const previewRenderedSubject = useMemo(() => {
    return renderTemplateForStudent(emailSubject, previewStudent);
  }, [emailSubject, previewStudent, activeSubject, customVenue, customDate, customTime, senderDesk]);

  const previewRenderedHeading = useMemo(() => {
    return renderTemplateForStudent(noticeHeading, previewStudent);
  }, [noticeHeading, previewStudent, activeSubject]);

  const previewRenderedBody = useMemo(() => {
    return renderTemplateForStudent(emailBody, previewStudent);
  }, [emailBody, previewStudent, activeSubject, customVenue, customDate, customTime, senderDesk, groups, selectedSubjectId]);

  // Insert tag into textarea
  const handleInsertTag = (tag: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) {
      setEmailBody(prev => `${prev} ${tag}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const updated = current.substring(0, start) + tag + current.substring(end);
    setEmailBody(updated);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // Quick Preset Templates for Classes
  const handleApplyPreset = (preset: 'presentation' | 'assignment' | 'reschedule' | 'notes' | 'attendance') => {
    const subName = activeSubject ? `${activeSubject.name} (${activeSubject.code})` : 'Class';
    if (preset === 'presentation') {
      setNoticeHeading('Semester Presentation Schedule & Order');
      setEmailSubject(`[Presentation] ${subName} - Schedule & Guidelines`);
      setEmailBody(`Dear {{STUDENT_NAME}},\n\nHere is the presentation schedule for {{SUBJECT_NAME}} ({{SUBJECT_CODE}}).\n\nFaculty Incharge: {{FACULTY}}\nVenue: {{VENUE}}\nDate: {{DATE}}\nYour Assigned Team: {{GROUP_INFO}}\n\nPlease ensure your slides and USB backup are ready before the session begins.\n\nBest regards,\n{{CR_NAME}}`);
    } else if (preset === 'assignment') {
      setNoticeHeading('Assignment Submission Deadline & Rubric');
      setEmailSubject(`[Deadline] ${subName} - Assignment Due Date`);
      setEmailBody(`Dear {{STUDENT_NAME}},\n\nThis is a reminder regarding the assignment submission for {{SUBJECT_NAME}} ({{SUBJECT_CODE}}).\n\nDue Date: {{DATE}}\nDue Time: {{TIME}}\n\nPlease ensure your submission follows the required guidelines to avoid late penalties.\n\nBest regards,\n{{CR_NAME}}`);
    } else if (preset === 'reschedule') {
      setNoticeHeading('Lecture Timing & Classroom Reschedule Notice');
      setEmailSubject(`[Reschedule] ${subName} - Updated Classroom & Timing`);
      setEmailBody(`Dear {{STUDENT_NAME}},\n\nPlease note that our lecture for {{SUBJECT_NAME}} has been rescheduled as instructed by {{FACULTY}}.\n\nNew Venue: {{VENUE}}\nNew Date: {{DATE}}\nNew Time: {{TIME}}\n\nPlease inform your hostel peers.\n\nBest regards,\n{{CR_NAME}}`);
    } else if (preset === 'notes') {
      setNoticeHeading("Professor's Course Documents & Reference Material");
      setEmailSubject(`[Study Notes] ${subName} - Reference Documents`);
      setEmailBody(`Dear {{STUDENT_NAME}},\n\nProfessor {{FACULTY}} has shared reference study materials and syllabus guidelines for {{SUBJECT_NAME}}.\nPlease find the documents attached.\n\nBest regards,\n{{CR_NAME}}`);
    } else if (preset === 'attendance') {
      setNoticeHeading('Attendance Shortage Review Notice');
      setEmailSubject(`[Urgent] ${subName} - Attendance Review List`);
      setEmailBody(`Dear {{STUDENT_NAME}} (Roll: {{ROLL_NO}}),\n\nFaculty has published the attendance review list for {{SUBJECT_NAME}}.\nStudents with attendance below 75% are advised to meet {{FACULTY}} immediately.\n\nBest regards,\n{{CR_NAME}}`);
    }
  };

  // Handle local document file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUri = reader.result as string;
        const newAttachment: AttachedFile = {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          filename: file.name,
          size: file.size,
          dataUri,
          contentType: file.type || 'application/octet-stream',
        };
        setAttachedFiles(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attached file
  const handleRemoveAttachment = (id: string) => {
    setAttachedFiles(prev => prev.filter(a => a.id !== id));
  };

  // Format WhatsApp string
  const whatsAppFormattedText = useMemo(() => {
    let text = `📢 *${previewRenderedHeading.toUpperCase()}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📚 *Subject:* ${activeSubject.name} (${activeSubject.code})\n`;
    text += `👨‍🏫 *Faculty:* ${activeSubject.teacherName}\n`;
    if (customVenue) text += `📍 *Venue:* ${customVenue}\n`;
    if (customDate) text += `📅 *Date:* ${customDate}\n`;
    if (customTime) text += `⏰ *Time:* ${customTime}\n`;
    text += `\n${previewRenderedBody.trim()}\n\n`;
    if (attachedFiles.length > 0) {
      text += `📎 *Attached Documents:* ${attachedFiles.map(a => a.filename).join(', ')}\n\n`;
    }
    text += `_Sent by ${senderDesk || 'Class Representative'}_`;
    return text;
  }, [previewRenderedHeading, previewRenderedBody, activeSubject, customVenue, customDate, customTime, attachedFiles, senderDesk]);

  // Copy text for WhatsApp
  const handleCopyForWhatsApp = () => {
    navigator.clipboard.writeText(whatsAppFormattedText);
    setCopiedWhatsAppWhole(true);
    setTimeout(() => setCopiedWhatsAppWhole(false), 2500);
  };

  // Gmail Verification
  const handleVerifyGmail = async () => {
    setIsVerifyingGmail(true);
    setVerificationFeedback(null);
    try {
      const res = await fetch('/api/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: tempGmailUser.trim(),
          appPassword: tempAppPassword.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updated: GmailConfig = {
          email: tempGmailUser.trim(),
          appPassword: tempAppPassword.trim(),
          senderName: tempSenderName.trim() || 'Class Representative (CR)',
          isConnected: true,
        };
        saveGmailConfig(updated);
        setGmailConfig(updated);
        setSenderDesk(updated.senderName);
        setVerificationFeedback({ success: true, message: 'Connected to Gmail SMTP successfully!' });
        setTimeout(() => {
          setIsConfigModalOpen(false);
          setVerificationFeedback(null);
        }, 1500);
      } else {
        setVerificationFeedback({ success: false, message: data.error || 'Verification failed. Check your App Password.' });
      }
    } catch (err: any) {
      setVerificationFeedback({ success: false, message: err.message || 'Network error verifying Gmail.' });
    } finally {
      setIsVerifyingGmail(false);
    }
  };

  // Test email to self
  const handleSendTestToSelf = async () => {
    if (!gmailConfig.isConnected || !gmailConfig.appPassword) {
      setIsConfigModalOpen(true);
      return;
    }
    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: gmailConfig.email,
          appPassword: gmailConfig.appPassword,
          to: gmailConfig.email,
          subject: `[TEST] ${previewRenderedSubject}`,
          text: formatStyle === 'simple' 
            ? `${previewRenderedHeading}\n\n${previewRenderedBody}` 
            : previewRenderedBody,
          senderName: senderDesk,
          attachments: attachedFiles.map(a => ({
            filename: a.filename,
            dataUri: a.dataUri,
            contentType: a.contentType,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailStatus({ success: true, message: `Test email sent to your Gmail inbox (${gmailConfig.email})!` });
      } else {
        setEmailStatus({ success: false, message: data.error || 'Test email failed. Check your App Password.' });
      }
    } catch (e: any) {
      setEmailStatus({ success: false, message: e.message || 'Error sending test email.' });
    } finally {
      setIsSendingEmail(false);
      setTimeout(() => setEmailStatus(null), 5000);
    }
  };

  // Whole class email dispatch
  const handleSendWholeClassEmail = async () => {
    if (!gmailConfig.isConnected || !gmailConfig.appPassword) {
      setIsConfigModalOpen(true);
      return;
    }

    const recipientEmails = sortedStudents
      .map(s => s.email?.trim() || `${s.rollNo}@woxsen.edu.in`)
      .filter(Boolean);

    if (recipientEmails.length === 0) {
      alert('No students found to email.');
      return;
    }

    setIsSendingEmail(true);
    setEmailStatus(null);

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: gmailConfig.email,
          appPassword: gmailConfig.appPassword,
          bcc: recipientEmails,
          subject: previewRenderedSubject,
          text: formatStyle === 'simple' 
            ? `${previewRenderedHeading}\n${'-'.repeat(40)}\n${previewRenderedBody}`
            : previewRenderedBody,
          senderName: senderDesk,
          attachments: attachedFiles.map(a => ({
            filename: a.filename,
            dataUri: a.dataUri,
            contentType: a.contentType,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEmailStatus({
          success: true,
          message: `Dispatched to all ${recipientEmails.length} classmates via Gmail (BCC)${attachedFiles.length > 0 ? ` with ${attachedFiles.length} attachment(s)` : ''}!`,
        });
        setSentStudentIds(new Set(sortedStudents.map(s => s.id)));
      } else {
        setEmailStatus({
          success: false,
          message: data.error || 'Failed to dispatch email.',
        });
      }
    } catch (err: any) {
      setEmailStatus({ success: false, message: err.message || 'Network error sending emails.' });
    } finally {
      setIsSendingEmail(false);
      setTimeout(() => setEmailStatus(null), 6000);
    }
  };

  // Individual student send
  const handleSendIndividualEmail = async (student: Student) => {
    if (!gmailConfig.isConnected || !gmailConfig.appPassword) {
      setIsConfigModalOpen(true);
      return;
    }

    const studentEmail = student.email?.trim() || `${student.rollNo}@woxsen.edu.in`;
    const customizedSub = renderTemplateForStudent(emailSubject, student);
    const customizedHeading = renderTemplateForStudent(noticeHeading, student);
    const customizedText = renderTemplateForStudent(emailBody, student);

    const messageContent = formatStyle === 'simple'
      ? `${customizedHeading}\n${'-'.repeat(40)}\n${customizedText}`
      : customizedText;

    setSendingStudentId(student.id);

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: gmailConfig.email,
          appPassword: gmailConfig.appPassword,
          to: studentEmail,
          subject: customizedSub,
          text: messageContent,
          senderName: senderDesk,
          attachments: attachedFiles.map(a => ({
            filename: a.filename,
            dataUri: a.dataUri,
            contentType: a.contentType,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSentStudentIds(prev => new Set(prev).add(student.id));
      } else {
        alert(`Failed to send to ${student.name}: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error sending to ${student.name}: ${err.message}`);
    } finally {
      setSendingStudentId(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filtered students for bottom roster
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return sortedStudents;
    const q = searchQuery.toLowerCase().trim();
    return sortedStudents.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.rollNo.toLowerCase().includes(q) ||
      (s.last4Digits && s.last4Digits.includes(q))
    );
  }, [sortedStudents, searchQuery]);

  return (
    <div className="space-y-6">
      
      {/* ---------------------------------------------------- */}
      {/* TOP HERO & SENDER DESK BAR                           */}
      {/* ---------------------------------------------------- */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden p-5 sm:p-7 text-white">
        
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Zap className="w-3 h-3 text-indigo-400" />
                CLASS ANNOUNCEMENTS & DOCUMENT DISPATCH
              </span>

              {gmailConfig.isConnected ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Gmail Connected
                </span>
              ) : (
                <button
                  onClick={() => setIsConfigModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition"
                >
                  <Key className="w-3 h-3" />
                  Connect Gmail App Password
                </button>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Class</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-rose-400">
                Mailer
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Dispatch official course notices, presentation schedules, and professor study materials directly to your classmates via Gmail.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700/80"
            >
              <Info className="w-4 h-4 text-slate-400" />
              <span>App Password Guide</span>
            </button>
          </div>
        </div>

        {/* Account & Sender Desk Bar */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* Sender Account */}
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-950/80 border border-indigo-700/40 text-indigo-400 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                  SENDER GMAIL ACCOUNT:
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs sm:text-sm font-bold text-white font-mono">
                    {gmailConfig.email || 'businessofficial1590@gmail.com'}
                  </span>
                  <button
                    onClick={() => setIsConfigModalOpen(true)}
                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 underline"
                  >
                    [→ {gmailConfig.isConnected ? 'Change' : 'Connect'}]
                  </button>
                </div>
              </div>
            </div>

            {/* Sender Desk Input */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                SENDER DESK:
              </span>
              <input
                type="text"
                value={senderDesk}
                onChange={e => {
                  setSenderDesk(e.target.value);
                  const updated = { ...gmailConfig, senderName: e.target.value };
                  setGmailConfig(updated);
                  saveGmailConfig(updated);
                }}
                placeholder="e.g. CR - Woxsen Uni"
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm font-bold text-white focus:outline-hidden focus:border-indigo-500 w-48 sm:w-56"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSendTestToSelf}
              disabled={isSendingEmail}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 transition border border-slate-700"
              title="Send a test email to your own Gmail inbox"
            >
              <Send className="w-3.5 h-3.5 text-indigo-400" />
              <span>Test to Self</span>
            </button>

            <button
              onClick={handleCopyForWhatsApp}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600/90 hover:bg-emerald-600 text-white transition shadow-sm"
              title="Copy formatted notice to clipboard for WhatsApp"
            >
              {copiedWhatsAppWhole ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied for WhatsApp!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy WhatsApp Text</span>
                </>
              )}
            </button>

            <button
              onClick={handleSendWholeClassEmail}
              disabled={isSendingEmail}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white transition shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {isSendingEmail ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>SEND TO CLASS ({sortedStudents.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Feedback Toast */}
        {emailStatus && (
          <div className={`mt-3 p-3 rounded-xl border text-xs font-bold flex items-center space-x-2 ${
            emailStatus.success 
              ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200' 
              : 'bg-rose-950/70 border-rose-500 text-rose-200'
          }`}>
            {emailStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{emailStatus.message}</span>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2-COLUMN SPLIT LAYOUT                                */}
      {/* Left: Content & Attachments | Right: Live Preview     */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ================================================== */}
        {/* LEFT COLUMN: </> 1. Content & Attachments (7 Cols) */}
        {/* ================================================== */}
        <div className="lg:col-span-6 xl:col-span-7 bg-slate-900 rounded-3xl border border-slate-800 p-5 sm:p-6 text-white space-y-5 shadow-lg">
          
          {/* Top Section Header with Format Style Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-indigo-400 font-bold">&lt;/&gt;</span>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                1. Notice Content & Attachments
              </h2>
            </div>

            {/* Format Style Selector: Designed Manner vs Simple Text */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setFormatStyle('designed')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  formatStyle === 'designed'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>Designed Card</span>
              </button>

              <button
                type="button"
                onClick={() => setFormatStyle('simple')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  formatStyle === 'simple'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Simple Text</span>
              </button>
            </div>
          </div>

          {/* Subject Context Selector */}
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5">
              TARGET CLASS SUBJECT:
            </span>
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
              {classes.map(cls => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setSelectedSubjectId(cls.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap border shrink-0 ${
                    cls.id === activeSubject.id
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <span>{cls.name}</span>
                  <span className="ml-1.5 text-[10px] font-mono text-slate-300">({cls.code})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Notice Presets */}
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1.5">
              LOAD CLASS TEMPLATE PRESET:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyPreset('presentation')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition border border-slate-700/60"
              >
                🎤 Presentation Order
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('assignment')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition border border-slate-700/60"
              >
                📝 Assignment Due
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('reschedule')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition border border-slate-700/60"
              >
                🔄 Class Reschedule
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('notes')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition border border-slate-700/60"
              >
                📚 Study Materials
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('attendance')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition border border-slate-700/60"
              >
                ⚠️ Attendance Warning
              </button>
            </div>
          </div>

          {/* Editable Notice Heading & Email Subject Line */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                NOTICE HEADING (MAIN TITLE)
              </label>
              <input
                type="text"
                value={noticeHeading}
                onChange={e => setNoticeHeading(e.target.value)}
                placeholder="e.g. Presentation Schedule & Guidelines"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm font-bold text-white focus:outline-hidden focus:border-indigo-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                EMAIL SUBJECT LINE
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="Email Subject"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm font-semibold text-white focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Optional Venue, Date, Time for Notice */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Venue / Room:
              </label>
              <input
                type="text"
                value={customVenue}
                onChange={e => setCustomVenue(e.target.value)}
                placeholder="e.g. Lab 304"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Date (Optional):
              </label>
              <input
                type="date"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Time (Optional):
              </label>
              <input
                type="text"
                value={customTime}
                onChange={e => setCustomTime(e.target.value)}
                placeholder="e.g. 10:00 AM"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          {/* Email Body Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                EMAIL CONTENT / BODY TEXT (EDITABLE)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                Supports Smart Student Tags
              </span>
            </div>
            <textarea
              ref={bodyTextareaRef}
              rows={8}
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs sm:text-sm text-slate-200 leading-relaxed focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Dynamic Smart Tags */}
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-2">
              CLICK TO INSERT DYNAMIC TAG:
            </span>
            <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => handleInsertTag('{{STUDENT_NAME}}')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 font-semibold transition border border-slate-700/80"
              >
                + Student Name
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{{LAST_4}}')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 font-semibold transition border border-slate-700/80"
              >
                + Last 4 Digits
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{{ROLL_NO}}')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 font-semibold transition border border-slate-700/80"
              >
                + Full Roll No
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{{SUBJECT_NAME}}')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 font-semibold transition border border-slate-700/80"
              >
                + Subject Name
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{{FACULTY}}')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 font-semibold transition border border-slate-700/80"
              >
                + Faculty Name
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{{DATE}}')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 font-semibold transition border border-slate-700/80"
              >
                + Date
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{{TIME}}')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 font-semibold transition border border-slate-700/80"
              >
                + Time
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{{VENUE}}')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 font-semibold transition border border-slate-700/80"
              >
                + Venue
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{{GROUP_INFO}}')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 font-semibold transition border border-slate-700/80"
              >
                + Group Number
              </button>
              <button
                type="button"
                onClick={() => handleInsertTag('{{CR_NAME}}')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 font-semibold transition border border-slate-700/80"
              >
                + CR Name
              </button>
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* ATTACH DOCUMENTS SECTION (PDFs, PPTs, Docs)          */}
          {/* ---------------------------------------------------- */}
          <div className="pt-3 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center space-x-1.5">
                <Paperclip className="w-4 h-4 text-indigo-400" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                  ATTACH DOCUMENTS (PDFS, PPTS, DOCX, IMAGES)
                </span>
                {attachedFiles.length > 0 && (
                  <span className="bg-indigo-500/30 text-indigo-300 px-2 py-0.2 rounded-full text-[10px] font-bold">
                    {attachedFiles.length} file{attachedFiles.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {/* Upload from Computer */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>+ Attach Document</span>
                </button>

                {/* Quick Attach from Professor's Stored Materials */}
                {materials.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsPickingPortalMaterial(!isPickingPortalMaterial)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>From Portal PDFs</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Picker dropdown from Portal Materials */}
            {isPickingPortalMaterial && materials.length > 0 && (
              <div className="mb-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                  Select a Professor's PDF stored in CR Portal:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {materials.map(mat => {
                    const isAlreadyAttached = attachedFiles.some(a => a.filename === mat.fileName);
                    return (
                      <div
                        key={mat.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="truncate mr-2">
                          <span className="font-bold text-slate-200 block truncate">{mat.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono truncate">{mat.fileName}</span>
                        </div>
                        <button
                          type="button"
                          disabled={isAlreadyAttached}
                          onClick={() => {
                            if (isAlreadyAttached) return;
                            const newAtt: AttachedFile = {
                              id: `mat-${mat.id}`,
                              filename: mat.fileName,
                              size: mat.fileSize || 50000,
                              dataUri: mat.fileDataUrl || 'data:application/pdf;base64,JVBERi0xLjQK',
                              contentType: mat.fileType || 'application/pdf',
                            };
                            setAttachedFiles(prev => [...prev, newAtt]);
                            setIsPickingPortalMaterial(false);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition ${
                            isAlreadyAttached
                              ? 'bg-slate-800 text-slate-500'
                              : 'bg-emerald-600 text-white hover:bg-emerald-500'
                          }`}
                        >
                          {isAlreadyAttached ? 'Attached' : '+ Attach'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attached Files List */}
            {attachedFiles.length === 0 ? (
              <div className="p-3 rounded-2xl bg-slate-950/50 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                No documents attached yet. Click "+ Attach Document" to attach assignment briefs, PPTs, or syllabus PDFs.
              </div>
            ) : (
              <div className="space-y-1.5">
                {attachedFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center space-x-2 truncate mr-2">
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="font-bold text-slate-200 truncate">{file.filename}</span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(file.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition shrink-0"
                      title="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rate Strategy */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                GMAIL DISPATCH RATE STRATEGY
              </span>
              <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase">
                SAFE & ANTI-SPAM
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setRateStrategy('instant')}
                className={`p-3 rounded-2xl border text-left transition ${
                  rateStrategy === 'instant'
                    ? 'bg-indigo-950/80 border-indigo-500 ring-1 ring-indigo-500/50 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-white">🚀 Draft All &</div>
                <div className="text-xs font-bold text-white">Send at Once</div>
                <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Simultaneous Send
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRateStrategy('1.5s')}
                className={`p-3 rounded-2xl border text-left transition ${
                  rateStrategy === '1.5s'
                    ? 'bg-indigo-950/80 border-indigo-500 ring-1 ring-indigo-500/50 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-white">1.5s Gap</div>
                <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Sequential Delay
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRateStrategy('3.0s')}
                className={`p-3 rounded-2xl border text-left transition ${
                  rateStrategy === '3.0s'
                    ? 'bg-indigo-950/80 border-indigo-500 ring-1 ring-indigo-500/50 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-white">3.0s Gap</div>
                <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Relaxed Delay
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRateStrategy('5.0s')}
                className={`p-3 rounded-2xl border text-left transition ${
                  rateStrategy === '5.0s'
                    ? 'bg-indigo-950/80 border-indigo-500 ring-1 ring-indigo-500/50 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-white">5.0s Gap</div>
                <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Cautious Delay
                </div>
              </button>
            </div>
          </div>

        </div>

        {/* ================================================== */}
        {/* RIGHT COLUMN: 👁 Live Email Client Preview (5 Cols)*/}
        {/* ================================================== */}
        <div className="lg:col-span-6 xl:col-span-5 flex flex-col space-y-4">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-900">
              <Eye className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Live Email Client Preview
              </h2>
            </div>

            {/* Switch student being previewed */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500 hidden sm:inline">Preview Student:</span>
              <select
                value={previewStudent.id}
                onChange={e => setPreviewStudentId(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-hidden"
              >
                {sortedStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.last4Digits} - {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Email Client Canvas Container */}
          <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col text-slate-200">
            
            {/* macOS / Modern Email Client Titlebar */}
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 text-[11px] text-slate-400 font-sans">
                  Gmail Preview • Mode: <strong className="text-indigo-400 capitalize">{formatStyle}</strong>
                </span>
              </div>
              <span className="text-[10px] text-slate-500 uppercase">Class Dispatch</span>
            </div>

            {/* Simulated Email Header (From, To, Subject) */}
            <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/60 space-y-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold w-16 shrink-0">From:</span>
                <span className="text-slate-200 font-medium truncate">
                  {senderDesk} &lt;{gmailConfig.email || 'businessofficial1590@gmail.com'}&gt;
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold w-16 shrink-0">To:</span>
                <span className="text-slate-200 font-medium truncate">
                  {previewStudent.name} &lt;{previewStudent.email || `${previewStudent.rollNo}@woxsen.edu.in`}&gt;
                </span>
              </div>

              <div className="flex items-start gap-2 pt-1 border-t border-slate-800/60">
                <span className="text-slate-500 font-bold w-16 shrink-0">Subject:</span>
                <span className="text-amber-300 font-bold leading-snug">
                  {previewRenderedSubject}
                </span>
              </div>
            </div>

            {/* Email Body Canvas: Either Designed Manner or Simple Text */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[750px]">
              
              {formatStyle === 'designed' ? (
                /* ============================================== */
                /* 1. DESIGNED MANNER (Rich Academic Card Layout) */
                /* ============================================== */
                <div className="space-y-4">
                  {/* Top Subject Academic Banner */}
                  <div className="rounded-2xl p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white shadow-lg">
                    <div className="flex items-center justify-between text-[11px] font-mono text-indigo-200 mb-1">
                      <span>WOXSEN UNIVERSITY</span>
                      <span>CODE: {activeSubject.code}</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">
                      {activeSubject.name}
                    </h3>
                    <div className="mt-1 text-xs text-indigo-100 flex items-center gap-2">
                      <span>Faculty: <strong>{activeSubject.teacherName}</strong></span>
                    </div>
                  </div>

                  {/* Notice Title Box */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 block mb-1">
                      OFFICIAL NOTICE
                    </span>
                    <h4 className="text-base sm:text-lg font-black text-white tracking-tight">
                      {previewRenderedHeading}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                      <span>RECIPIENT: <strong className="text-slate-200">{previewStudent.name}</strong></span>
                      <span>•</span>
                      <span>ROLL: {previewStudent.rollNo}</span>
                      <span>•</span>
                      <span className="text-indigo-300 font-bold">LAST 4: {previewStudent.last4Digits}</span>
                    </div>
                  </div>

                  {/* Date, Time & Venue Key Highlights (STRICTLY ONLY WHEN PUT!) */}
                  {(customDate || customTime || customVenue) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {(customDate || customTime) && (
                        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center space-x-1 mb-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            <span>SCHEDULE</span>
                          </span>
                          <div className="font-bold text-white font-mono">
                            {customDate || 'Class Lecture'}
                          </div>
                          {customTime && (
                            <div className="text-indigo-300 text-[11px] font-mono mt-0.5">
                              {customTime}
                            </div>
                          )}
                        </div>
                      )}

                      {customVenue && (
                        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center space-x-1 mb-1">
                            <MapPin className="w-3.5 h-3.5 text-rose-400" />
                            <span>CLASSROOM / VENUE</span>
                          </span>
                          <div className="font-bold text-white font-mono truncate">
                            {customVenue}
                          </div>
                          <div className="text-slate-400 text-[11px] font-mono mt-0.5">
                            Campus Academic Block
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Formatted Body Text */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                    {previewRenderedBody}
                  </div>

                  {/* Attached Documents Preview Badge */}
                  {attachedFiles.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>ATTACHED DOCUMENTS ({attachedFiles.length}):</span>
                      </span>
                      <div className="space-y-1.5">
                        {attachedFiles.map(att => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono"
                          >
                            <span className="text-slate-200 truncate">{att.filename}</span>
                            <span className="text-indigo-400 font-bold text-[10px] shrink-0 ml-2">
                              {formatFileSize(att.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CR Official Signature */}
                  <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">DISPATCHED BY:</span>
                      <span className="font-black text-white">{senderDesk}</span>
                      <div className="text-[11px] text-slate-400">Class Representative • Woxsen University</div>
                    </div>
                    <span className="text-emerald-400 text-[11px] font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                      ✓ Official CR Notice
                    </span>
                  </div>
                </div>
              ) : (
                /* ============================================== */
                /* 2. SIMPLE TEXT (Heading & Content Below)       */
                /* ============================================== */
                <div className="bg-white rounded-2xl p-6 text-slate-900 shadow-md space-y-4 font-sans border border-slate-200">
                  {/* Notice Heading on Top */}
                  <div className="border-b-2 border-slate-900 pb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block mb-0.5">
                      OFFICIAL NOTICE
                    </span>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-snug">
                      {previewRenderedHeading}
                    </h3>
                  </div>

                  {/* Class Meta Line */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>Subject: <strong className="text-slate-900">{activeSubject.name} ({activeSubject.code})</strong></span>
                    <span>•</span>
                    <span>Faculty: <strong className="text-slate-900">{activeSubject.teacherName}</strong></span>
                    {customVenue && (
                      <>
                        <span>•</span>
                        <span>Venue: <strong className="text-slate-900">{customVenue}</strong></span>
                      </>
                    )}
                    {customDate && (
                      <>
                        <span>•</span>
                        <span>Date: <strong className="text-slate-900">{customDate}</strong></span>
                      </>
                    )}
                    {customTime && (
                      <>
                        <span>•</span>
                        <span>Time: <strong className="text-slate-900">{customTime}</strong></span>
                      </>
                    )}
                  </div>

                  {/* Simple Text Content */}
                  <div className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed py-2">
                    {previewRenderedBody}
                  </div>

                  {/* Simple Attachments Line */}
                  {attachedFiles.length > 0 && (
                    <div className="pt-3 border-t border-slate-200 text-xs text-slate-700 space-y-1.5">
                      <strong className="text-slate-900 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Attached Documents:</span>
                      </strong>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1 font-mono text-[11px]">
                        {attachedFiles.map(att => (
                          <li key={att.id}>
                            {att.filename} ({formatFileSize(att.size)})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Simple Signoff */}
                  <div className="pt-3 border-t border-slate-200 text-xs text-slate-600">
                    <div>Regards,</div>
                    <div className="font-bold text-slate-900">{senderDesk}</div>
                    <div className="text-[11px] text-slate-500">Class Representative, Woxsen University</div>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. INDIVIDUAL 1-TO-1 ROSTER TABLE                    */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              1-to-1 Class Roster & Single-Click Dispatch
            </h3>
            <p className="text-xs text-slate-500">
              Students sorted in ascending order by last 4 digits. Dispatch personalized announcements or open individually in Gmail / WhatsApp.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search roll (last 4) or name..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Student Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-3 w-16 text-center">Last 4</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Full Roll No</th>
                <th className="py-2.5 px-3">Email Address</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map(student => {
                const isSent = sentStudentIds.has(student.id);
                const isSending = sendingStudentId === student.id;
                const studentEmail = student.email || `${student.rollNo}@woxsen.edu.in`;

                return (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-mono font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-100">
                        {student.last4Digits}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {student.name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {student.rollNo}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                      {studentEmail}
                    </td>
                    <td className="py-2.5 px-3">
                      {isSent ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Sent
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Ready
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleSendIndividualEmail(student)}
                        disabled={isSending || isSendingEmail}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
                        title="Send personalized email via Gmail App Password"
                      >
                        {isSending ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        <span>Send</span>
                      </button>

                      <a
                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(studentEmail)}&su=${encodeURIComponent(renderTemplateForStudent(emailSubject, student))}&body=${encodeURIComponent(renderTemplateForStudent(emailBody, student))}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                        title="Open in Gmail Web compose"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Gmail Web</span>
                      </a>

                      <button
                        onClick={() => {
                          const customMsg = renderTemplateForStudent(emailBody, student);
                          const waText = `📢 *${renderTemplateForStudent(noticeHeading, student)}*\n\n${customMsg}\n\n_Sent by ${senderDesk}_`;
                          navigator.clipboard.writeText(waText);
                          setCopiedStudentId(student.id);
                          setTimeout(() => setCopiedStudentId(null), 2000);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition border border-emerald-200"
                        title="Copy message customized for WhatsApp"
                      >
                        {copiedStudentId === student.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>WhatsApp</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* ---------------------------------------------------- */}
      {/* GMAIL APP PASSWORD MODAL SETUP                       */}
      {/* ---------------------------------------------------- */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Connect Gmail (App Password)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official 16-Character Google App Password
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-5 space-y-4">
              
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950 space-y-2">
                <span className="font-extrabold text-indigo-900 block">
                  Quick 1-Minute Setup Guide:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-slate-700">
                  <li>Open <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">Google Account Security</a>.</li>
                  <li>Ensure <strong>2-Step Verification</strong> is ON.</li>
                  <li>Under 2-Step Verification, select <strong>App passwords</strong>.</li>
                  <li>Name it "CR Portal", generate the 16-letter code, and paste it below.</li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Your Gmail Address:
                </label>
                <input
                  type="email"
                  value={tempGmailUser}
                  onChange={e => setTempGmailUser(e.target.value)}
                  placeholder="e.g. businessofficial1590@gmail.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Google 16-Character App Password:
                </label>
                <input
                  type="password"
                  value={tempAppPassword}
                  onChange={e => setTempAppPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sender Desk / Display Name:
                </label>
                <input
                  type="text"
                  value={tempSenderName}
                  onChange={e => setTempSenderName(e.target.value)}
                  placeholder="e.g. Class Representative (CR)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {verificationFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-bold flex items-center space-x-2 ${
                  verificationFeedback.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {verificationFeedback.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{verificationFeedback.message}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVerifyGmail}
                  disabled={isVerifyingGmail || !tempGmailUser || !tempAppPassword}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                >
                  {isVerifyingGmail ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying SMTP...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify & Save</span>
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
