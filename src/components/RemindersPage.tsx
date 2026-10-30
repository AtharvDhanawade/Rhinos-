import React, { useState, useMemo } from 'react';
import { Student, ClassSubject, ClassReminder, AssignmentGroup } from '../types';
import { getTodayDateString, sortStudentsByLast4Digits } from '../utils/storage';
import { 
  Bell, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Share2, 
  Copy, 
  Check, 
  Users, 
  BookOpen, 
  ChevronRight, 
  X, 
  Sparkles, 
  Filter, 
  ArrowRight,
  Send,
  Mail
} from 'lucide-react';

interface RemindersPageProps {
  students: Student[];
  classes: ClassSubject[];
  activeClassId: string;
  reminders: ClassReminder[];
  groups: AssignmentGroup[];
  onSaveReminder: (reminder: ClassReminder) => void;
  onDeleteReminder: (reminderId: string) => void;
  onSaveGroup: (group: AssignmentGroup) => void;
  onNavigateToBroadcast?: (prefilledText: string) => void;
}

export const RemindersPage: React.FC<RemindersPageProps> = ({
  students,
  classes,
  activeClassId,
  reminders,
  groups,
  onSaveReminder,
  onDeleteReminder,
  onSaveGroup,
  onNavigateToBroadcast
}) => {
  const sortedStudents = useMemo(() => sortStudentsByLast4Digits(students), [students]);
  const todayStr = getTodayDateString();

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activePresentationReminder, setActivePresentationReminder] = useState<ClassReminder | null>(null);

  // Form state
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderSubjectId, setReminderSubjectId] = useState(activeClassId || (classes[0]?.id || ''));
  const [reminderType, setReminderType] = useState<ClassReminder['type']>('presentation');
  const [reminderDueDate, setReminderDueDate] = useState('');
  const [reminderDueTime, setReminderDueTime] = useState('');
  const [reminderInformDate, setReminderInformDate] = useState('');
  const [reminderDescription, setReminderDescription] = useState('');

  // Presentation group manager state
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [copiedAnnouncementId, setCopiedAnnouncementId] = useState<string | null>(null);

  // Filtered Reminders
  const filteredReminders = useMemo(() => {
    return reminders
      .filter(r => {
        if (!showCompleted && r.isCompleted) return false;
        if (filterType !== 'all' && r.type !== filterType) return false;
        if (filterSubjectId !== 'all' && r.subjectId !== filterSubjectId) return false;
        return true;
      })
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [reminders, filterType, filterSubjectId, showCompleted]);

  // Urgent alerts for CR (Reminders where today >= informDate && not completed)
  const urgentInformReminders = useMemo(() => {
    return reminders.filter(r => {
      if (r.isCompleted) return false;
      if (!r.informDate) return false;
      return todayStr >= r.informDate && todayStr <= r.dueDate;
    });
  }, [reminders, todayStr]);

  // Handle open create modal
  const handleOpenCreateModal = () => {
    setReminderTitle('');
    setReminderSubjectId(activeClassId || (classes[0]?.id || ''));
    setReminderType('presentation');
    setReminderDueDate('');
    setReminderDueTime('');
    setReminderInformDate('');
    setReminderDescription('');
    setIsCreateModalOpen(true);
  };

  // Submit new reminder (Date and Time are optional)
  const handleCreateReminderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTitle.trim()) return;

    const newReminder: ClassReminder = {
      id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      subjectId: reminderSubjectId,
      title: reminderTitle.trim(),
      type: reminderType,
      dueDate: reminderDueDate.trim(),
      dueTime: reminderDueTime.trim(),
      informDate: reminderInformDate.trim(),
      description: reminderDescription.trim(),
      completedGroupIds: [],
      rescheduledGroupDates: {},
      isCompleted: false,
      createdAt: new Date().toISOString()
    };

    onSaveReminder(newReminder);
    setIsCreateModalOpen(false);
  };

  // Toggle Reminder Completed
  const handleToggleCompleted = (reminder: ClassReminder) => {
    onSaveReminder({
      ...reminder,
      isCompleted: !reminder.isCompleted
    });
  };

  // Groups for active presentation modal
  const activeSubjectGroups = useMemo(() => {
    if (!activePresentationReminder) return [];
    return groups
      .filter(g => g.subjectId === activePresentationReminder.subjectId)
      .sort((a, b) => a.groupNumber - b.groupNumber);
  }, [activePresentationReminder, groups]);

  // Toggle group completed for a presentation
  const handleToggleGroupDoneInPresentation = (reminder: ClassReminder, group: AssignmentGroup) => {
    const isCurrentlyDone = group.presentationStatus === 'completed';
    const newStatus = isCurrentlyDone ? 'pending' : 'completed';

    const updatedGroup: AssignmentGroup = {
      ...group,
      presentationStatus: newStatus,
      updatedAt: new Date().toISOString()
    };
    onSaveGroup(updatedGroup);

    const completedSet = new Set(reminder.completedGroupIds || []);
    if (newStatus === 'completed') {
      completedSet.add(group.id);
    } else {
      completedSet.delete(group.id);
    }

    onSaveReminder({
      ...reminder,
      completedGroupIds: Array.from(completedSet)
    });
  };

  // Reschedule remaining pending groups
  const handleReschedulePendingGroups = (reminder: ClassReminder) => {
    if (!rescheduleDate) {
      alert('Please select a date to reschedule the remaining groups to.');
      return;
    }

    const pendingGroups = activeSubjectGroups.filter(g => g.presentationStatus !== 'completed');
    if (pendingGroups.length === 0) {
      alert('All groups have already completed their presentation!');
      return;
    }

    pendingGroups.forEach(g => {
      onSaveGroup({
        ...g,
        presentationStatus: 'rescheduled',
        rescheduledDate: rescheduleDate,
        updatedAt: new Date().toISOString()
      });
    });

    const rescheduledMap = { ...(reminder.rescheduledGroupDates || {}) };
    pendingGroups.forEach(g => {
      rescheduledMap[g.id] = rescheduleDate;
    });

    onSaveReminder({
      ...reminder,
      rescheduledGroupDates: rescheduledMap
    });

    alert(`Rescheduled ${pendingGroups.length} groups to ${rescheduleDate}. Copy the updated announcement below to inform the class!`);
  };

  // Copy WhatsApp Presentation Status Notice
  const handleCopyPresentationWhatsApp = (reminder: ClassReminder) => {
    const subject = classes.find(c => c.id === reminder.subjectId);
    const subName = subject ? `${subject.name} (${subject.code})` : 'Class';

    const completed = activeSubjectGroups.filter(g => g.presentationStatus === 'completed');
    const rescheduled = activeSubjectGroups.filter(g => g.presentationStatus === 'rescheduled');
    const pending = activeSubjectGroups.filter(g => g.presentationStatus === 'pending');

    let text = `📢 *${subName} - Presentation Schedule Update*\n\n`;
    text += `*Event:* ${reminder.title}\n`;
    text += `*Date:* ${reminder.dueDate}\n\n`;

    if (completed.length > 0) {
      text += `✅ *Groups Finished Today:*\n`;
      completed.forEach(g => {
        text += `• ${g.groupName}${g.topic ? ` - "${g.topic}"` : ''}\n`;
      });
      text += `\n`;
    }

    if (rescheduled.length > 0) {
      const targetD = rescheduled[0]?.rescheduledDate || rescheduleDate || 'Next Class';
      text += `⏳ *Groups Rescheduled to ${targetD}:*\n`;
      rescheduled.forEach(g => {
        text += `• ${g.groupName}${g.topic ? ` - "${g.topic}"` : ''}\n`;
      });
      text += `\n`;
    }

    if (pending.length > 0) {
      text += `⏳ *Remaining Pending Groups:*\n`;
      pending.forEach(g => {
        text += `• ${g.groupName}${g.topic ? ` - "${g.topic}"` : ''}\n`;
      });
      text += `\n`;
    }

    text += `_Please make sure all group slides and team members are ready on time!_\n`;
    text += `_Class Representative (CR) Notice_`;

    navigator.clipboard.writeText(text);
    setCopiedAnnouncementId(reminder.id);
    setTimeout(() => setCopiedAnnouncementId(null), 2500);
  };

  // Copy standard reminder text for WhatsApp
  const handleCopyGeneralReminderWhatsApp = (reminder: ClassReminder) => {
    const subject = classes.find(c => c.id === reminder.subjectId);
    const subName = subject ? `${subject.name} (${subject.code})` : 'Class Notice';

    let icon = '🔔';
    if (reminder.type === 'assignment') icon = '📝';
    if (reminder.type === 'presentation') icon = '🎤';
    if (reminder.type === 'exam' || reminder.type === 'quiz') icon = '📋';
    if (reminder.type === 'project') icon = '💻';

    let text = `${icon} *REMINDER: ${reminder.title.toUpperCase()}*\n\n`;
    text += `📚 *Subject:* ${subName}\n`;
    if (reminder.dueDate) text += `📅 *Deadline Date:* ${reminder.dueDate}\n`;
    if (reminder.dueTime) text += `⏰ *Time:* ${reminder.dueTime}\n`;
    if (reminder.description) text += `\nℹ️ *Instructions / Details:*\n${reminder.description}\n`;
    text += `\n_Please complete your work before the deadline to avoid late penalties._\n`;
    text += `_CR Reminder_`;

    navigator.clipboard.writeText(text);
    setCopiedAnnouncementId(reminder.id);
    setTimeout(() => setCopiedAnnouncementId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Metrics */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Deadlines & Reminders
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Track assignments, quizzes, and presentations. Reschedule multi-day presentations when not all groups finish on deadline day.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Deadline / Reminder</span>
          </button>
        </div>

        {/* Action Required Today Alert Banner */}
        {urgentInformReminders.length > 0 && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-2">
            <div className="flex items-center space-x-2 text-amber-900 font-extrabold text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Action Required Today: Inform the class for {urgentInformReminders.length} upcoming event{urgentInformReminders.length === 1 ? '' : 's'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {urgentInformReminders.map(rem => {
                const sub = classes.find(c => c.id === rem.subjectId);
                return (
                  <div
                    key={rem.id}
                    className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-amber-200 text-xs"
                  >
                    <div className="truncate mr-2">
                      <span className="font-bold text-slate-900">{rem.title}</span>
                      <span className="text-slate-500 ml-1.5 font-medium">
                        ({sub ? sub.code : 'General'})
                        {rem.dueDate && <> • Due: <strong className="text-amber-800">{rem.dueDate}</strong></>}
                        {rem.dueTime && <span className="text-slate-500"> ({rem.dueTime})</span>}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyGeneralReminderWhatsApp(rem)}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 transition shrink-0 text-[11px]"
                    >
                      Copy Notice
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-500">Filter:</span>

            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Types</option>
              <option value="presentation">🎤 Presentations</option>
              <option value="assignment">📝 Assignments</option>
              <option value="project">💻 Projects</option>
              <option value="exam">📋 Exams & Quizzes</option>
              <option value="general">🔔 General</option>
            </select>

            <select
              value={filterSubjectId}
              onChange={e => setFilterSubjectId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Subjects</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center space-x-1.5 text-slate-600 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={e => setShowCompleted(e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span>Show Completed ({reminders.filter(r => r.isCompleted).length})</span>
          </label>
        </div>
      </div>

      {/* Deadlines List */}
      {filteredReminders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            No Upcoming Deadlines Found
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4">
            Add presentations, project milestones, or assignment due dates to alert the class ahead of time.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Deadline</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReminders.map(reminder => {
            const subject = classes.find(c => c.id === reminder.subjectId);
            const isCopied = copiedAnnouncementId === reminder.id;
            const isDueToday = Boolean(reminder.dueDate && todayStr === reminder.dueDate);
            const isOverdue = Boolean(reminder.dueDate && todayStr > reminder.dueDate && !reminder.isCompleted);

            // Presentation group progress
            const subGroups = groups.filter(g => g.subjectId === reminder.subjectId);
            const completedCount = subGroups.filter(g => g.presentationStatus === 'completed').length;
            const rescheduledCount = subGroups.filter(g => g.presentationStatus === 'rescheduled').length;

            const hasDateTimeInfo = Boolean(reminder.dueDate || reminder.dueTime || reminder.informDate || isDueToday || isOverdue);

            return (
              <div
                key={reminder.id}
                className={`bg-white rounded-2xl border transition flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  reminder.isCompleted
                    ? 'border-slate-200 opacity-60 bg-slate-50/40'
                    : isOverdue
                    ? 'border-rose-300'
                    : isDueToday
                    ? 'border-amber-400 ring-1 ring-amber-200'
                    : 'border-slate-200/90'
                }`}
              >
                <div className="p-4 sm:p-5">
                  {/* Subject & Type Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {subject ? `${subject.name} (${subject.code})` : 'All Subjects'}
                    </span>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize bg-slate-100 text-slate-700">
                      {reminder.type}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className={`text-base font-extrabold text-slate-900 leading-snug mb-1 ${
                    reminder.isCompleted ? 'line-through text-slate-400' : ''
                  }`}>
                    {reminder.title}
                  </h4>

                  {/* Dates & Times - Strictly only rendered when date or time has been entered */}
                  {hasDateTimeInfo && (
                    <div className="mt-3 space-y-1 text-xs">
                      {(reminder.dueDate || reminder.dueTime) && (
                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            {reminder.dueDate && (
                              <>
                                Due Date: <strong className="text-slate-900">{reminder.dueDate}</strong>
                              </>
                            )}
                            {reminder.dueDate && reminder.dueTime && <span className="text-slate-500"> at </span>}
                            {reminder.dueTime && !reminder.dueDate && <span className="text-slate-600 font-medium">Time: </span>}
                            {reminder.dueTime && (
                              <strong className="text-slate-800">{reminder.dueTime}</strong>
                            )}
                          </span>
                        </div>
                      )}

                      {reminder.informDate && (
                        <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>Inform Class on: <strong>{reminder.informDate}</strong></span>
                        </div>
                      )}

                      {isDueToday && !reminder.isCompleted && (
                        <span className="inline-block text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          Due Today!
                        </span>
                      )}

                      {isOverdue && (
                        <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                          Past Deadline
                        </span>
                      )}
                    </div>
                  )}

                  {/* Multi-Day Presentation Tracker Box */}
                  {reminder.type === 'presentation' && subGroups.length > 0 && (
                    <div className="mt-3 bg-purple-50/70 border border-purple-200/70 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-purple-900 flex items-center space-x-1">
                          <Users className="w-3.5 h-3.5 text-purple-600" />
                          <span>Presentation Progress:</span>
                        </span>
                        <span className="font-extrabold text-purple-800 text-[11px]">
                          {completedCount}/{subGroups.length} Done
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-purple-200/60 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-purple-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${(completedCount / subGroups.length) * 100}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">
                          {rescheduledCount > 0 ? `${rescheduledCount} Rescheduled` : `${subGroups.length - completedCount} Pending`}
                        </span>
                        <button
                          onClick={() => setActivePresentationReminder(reminder)}
                          className="text-purple-700 font-bold hover:underline"
                        >
                          Check Off & Reschedule →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {reminder.description && (
                    <p className="mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2">
                      {reminder.description}
                    </p>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleToggleCompleted(reminder)}
                      className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        reminder.isCompleted
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{reminder.isCompleted ? 'Done' : 'Mark Done'}</span>
                    </button>

                    <button
                      onClick={() => handleCopyGeneralReminderWhatsApp(reminder)}
                      title="Copy formatted notice for WhatsApp"
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5 text-amber-600" />
                          <span>WhatsApp</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (window.confirm(`Delete reminder "${reminder.title}"?`)) {
                        onDeleteReminder(reminder.id);
                      }
                    }}
                    title="Delete reminder"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE REMINDER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Add Deadline / Reminder
                  </h3>
                  <p className="text-xs text-slate-500">Track presentation schedules or assignment dates</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReminderSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Event / Milestone Title:
                </label>
                <input
                  type="text"
                  value={reminderTitle}
                  onChange={e => setReminderTitle(e.target.value)}
                  placeholder="e.g. Unit 3 Presentations or Lab Report Submission"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subject:
                  </label>
                  <select
                    value={reminderSubjectId}
                    onChange={e => setReminderSubjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reminder Type:
                  </label>
                  <select
                    value={reminderType}
                    onChange={e => setReminderType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="presentation">🎤 Presentation (Multi-Group)</option>
                    <option value="assignment">📝 Assignment Submission</option>
                    <option value="project">💻 Project Report</option>
                    <option value="exam">📋 Exam / Midterm / Quiz</option>
                    <option value="general">🔔 General Announcement</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Due Date <span className="text-slate-400 font-normal">(Optional)</span>:
                    </label>
                    {reminderDueDate && (
                      <button
                        type="button"
                        onClick={() => setReminderDueDate('')}
                        className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={reminderDueDate}
                    onChange={e => setReminderDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Due Time <span className="text-slate-400 font-normal">(Optional)</span>:
                    </label>
                    {reminderDueTime && (
                      <button
                        type="button"
                        onClick={() => setReminderDueTime('')}
                        className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={reminderDueTime}
                    onChange={e => setReminderDueTime(e.target.value)}
                    placeholder="e.g. 11:59 PM or leave blank"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    CR Inform Date <span className="text-slate-400 font-normal">(When to alert class, Optional)</span>:
                  </label>
                  {reminderInformDate && (
                    <button
                      type="button"
                      onClick={() => setReminderInformDate('')}
                      className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={reminderInformDate}
                  onChange={e => setReminderInformDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Instructions / Faculty Notes:
                </label>
                <textarea
                  value={reminderDescription}
                  onChange={e => setReminderDescription(e.target.value)}
                  placeholder="e.g. PPT limit is 12 slides, USB drive required."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition shadow-sm"
                >
                  Save Deadline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MULTI-DAY PRESENTATION RESCHEDULE MODAL */}
      {activePresentationReminder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-purple-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Presentation Progress & Multi-Day Rescheduler
                  </h3>
                  <p className="text-xs text-slate-600">
                    {activePresentationReminder.title} • Date: {activePresentationReminder.dueDate}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActivePresentationReminder(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="bg-purple-50 border border-purple-200/80 p-3.5 rounded-2xl text-xs text-purple-900 leading-relaxed">
                <strong className="font-bold">Multi-Day Tool:</strong> Presentations often can't finish in one day!
                Check off groups that finished presenting today. Pick a new date for remaining groups, and copy the class update in 1 click.
              </div>

              {/* Group Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Groups That Finished Presenting Today ({activeSubjectGroups.filter(g => g.presentationStatus === 'completed').length} / {activeSubjectGroups.length} Done):
                  </span>
                </div>

                {activeSubjectGroups.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 text-center border border-dashed rounded-xl">
                    No groups found for this subject.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {activeSubjectGroups.map(group => {
                      const isDone = group.presentationStatus === 'completed';
                      const isRescheduled = group.presentationStatus === 'rescheduled';

                      return (
                        <div
                          key={group.id}
                          onClick={() => handleToggleGroupDoneInPresentation(activePresentationReminder, group)}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer select-none transition ${
                            isDone
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                              : isRescheduled
                              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 truncate">
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="font-bold text-slate-900">
                              {group.groupName}
                            </span>
                            {group.topic && (
                              <span className="text-slate-500 truncate">
                                — "{group.topic}"
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 shrink-0 ml-2">
                            {isDone && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                                Completed ✅
                              </span>
                            )}
                            {isRescheduled && !isDone && (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md">
                                Rescheduled: {group.rescheduledDate || 'Next Date'}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              {group.memberStudentIds.length} members
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reschedule Unfinished Groups Box */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Reschedule Remaining Unfinished Groups to New Date:</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={e => setRescheduleDate(e.target.value)}
                    className="w-full sm:flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleReschedulePendingGroups(activePresentationReminder)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition shadow-sm"
                  >
                    Reschedule Groups
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleCopyPresentationWhatsApp(activePresentationReminder)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
              >
                {copiedAnnouncementId === activePresentationReminder.id ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Announcement Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Copy WhatsApp Status Update</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActivePresentationReminder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
