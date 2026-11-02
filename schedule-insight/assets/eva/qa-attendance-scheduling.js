// Q&A data batch: Daily Clock-In & Attendance (1-20) + Shift Monitoring (21-40)
// Self-registers into window.qaDatabase — loaded via <script src> before the main inline script.
// Each entry: { id, section, order, question, icon, keywords[], body }
//   - section/order drive the fullscreen sidebar grouping and sort order
//   - question is shown verbatim in the sidebar and as the response header
//   - keywords are substring triggers used for free-text matching in the chat input
// To add another batch, create a new data/qa-<topic>.js file in this same shape
// and add one <script src> line for it in index.html.
(function () {
    window.qaDatabase = window.qaDatabase || [];

    window.qaDatabase.push(
        {
            id: 'att_not_clocked_in',
            section: 'Daily Clock-In & Attendance',
            order: 1,
            question: "Who hasn't clocked in yet today?",
            icon: '⏰',
            keywords: ["hasn't clocked in", "haven't clocked in", "not clocked in yet", "who hasn't clocked", "not yet clocked in"],
            body: `<b style="color:#dc2626;">3 employees haven't clocked in yet:</b><br>
                <div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • <b>Lisa Brown</b> — Scheduled: 8:00 AM <span style="color:#dc2626;">(15 min overdue)</span><br>
                    • <b>Tom Wilson</b> — Scheduled: 2:00 PM (starts in 25 min)<br>
                    • <b>Kevin Lee</b> — Scheduled: 2:00 PM (starts in 25 min)
                </div>`
        },
        {
            id: 'att_currently_working',
            section: 'Daily Clock-In & Attendance',
            order: 2,
            question: 'Which employees are currently working?',
            icon: '👥',
            keywords: ['currently working', 'who is working', 'who\'s working', 'employees are working right now'],
            body: `<b style="color:#22c55e;">14 employees are currently working:</b><br>
                <table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Employee</td><td style="padding:8px; border:1px solid #e5e7eb;">Role</td><td style="padding:8px; border:1px solid #e5e7eb;">Since</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Sarah Mitchell</td><td style="padding:8px; border:1px solid #f0f0f0;">Cashier</td><td style="padding:8px; border:1px solid #f0f0f0;">10:00 AM</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">David Chen</td><td style="padding:8px; border:1px solid #f0f0f0;">Cook</td><td style="padding:8px; border:1px solid #f0f0f0;">10:15 AM</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;"><b>+ 12 more employees</b></td><td style="padding:8px; border:1px solid #f0f0f0;">—</td><td style="padding:8px; border:1px solid #f0f0f0;">—</td></tr>
                </table>`
        },
        {
            id: 'att_running_late',
            section: 'Daily Clock-In & Attendance',
            order: 3,
            question: 'Who is running late today?',
            icon: '🚨',
            keywords: ['running late', 'who is late', "who's late", 'late today', 'late arrivals today'],
            body: `<b style="color:#f59e0b;">2 employees are running late:</b><br>
                <div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Mark Johnson</b> — Scheduled: 6:00 AM | Arrived: 6:18 AM | Late by 18 min<br>
                    <b>Tom Wilson</b> — Scheduled: 2:00 PM | Not yet arrived | 12 min late
                </div>`
        },
        {
            id: 'att_clocked_in_early',
            section: 'Daily Clock-In & Attendance',
            order: 4,
            question: 'Show employees who clocked in early.',
            icon: '⏱️',
            keywords: ['clocked in early', 'arrived early', 'came in early'],
            body: `<b style="color:#22c55e;">3 employees clocked in ahead of schedule:</b><br>
                <div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • <b>Rachel Green</b> — Scheduled: 10:00 AM | Clocked in: 9:50 AM (10 min early)<br>
                    • <b>David Chen</b> — Scheduled: 10:30 AM | Clocked in: 10:15 AM (15 min early)<br>
                    • <b>Sarah Mitchell</b> — Scheduled: 10:15 AM | Clocked in: 10:00 AM (15 min early)
                </div>`
        },
        {
            id: 'att_missed_shift',
            section: 'Daily Clock-In & Attendance',
            order: 5,
            question: 'Which employees missed their scheduled shift?',
            icon: '❌',
            keywords: ['missed their scheduled shift', 'missed shift', 'missed their shift'],
            body: `<b style="color:#dc2626;">1 employee missed a scheduled shift today:</b><br>
                <div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Lisa Brown</b> — Scheduled: 8:00 AM – 4:00 PM (Cashier) | Status: <span style="color:#dc2626; font-weight:600;">No-show, no call</span>
                </div>`
        },
        {
            id: 'att_forgot_clockout',
            section: 'Daily Clock-In & Attendance',
            order: 6,
            question: 'Who forgot to clock out yesterday?',
            icon: '🕐',
            keywords: ['forgot to clock out', 'didn\'t clock out', 'never clocked out', 'missing clock out'],
            body: `<b style="color:#f59e0b;">2 employees didn't clock out yesterday:</b><br>
                <div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • <b>James Parker</b> — Clocked in 6:00 AM, no clock-out recorded (shift ended 2:00 PM)<br>
                    • <b>Maria Gonzalez</b> — Clocked in 2:00 PM, no clock-out recorded (shift ended 10:00 PM)
                </div><br>
                <span style="color:#2563eb;">💡 These punches need a manual correction before payroll runs.</span>`
        },
        {
            id: 'att_issues_month',
            section: 'Daily Clock-In & Attendance',
            order: 7,
            question: 'Which employees have attendance issues this month?',
            icon: '📋',
            keywords: ['attendance issues this month', 'attendance problems this month'],
            body: `<table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Employee</td><td style="padding:8px; border:1px solid #e5e7eb;">Late</td><td style="padding:8px; border:1px solid #e5e7eb;">No-Shows</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Lisa Brown</td><td style="padding:8px; border:1px solid #f0f0f0;">8</td><td style="padding:8px; border:1px solid #f0f0f0; color:#dc2626;">3</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Mark Johnson</td><td style="padding:8px; border:1px solid #f0f0f0;">5</td><td style="padding:8px; border:1px solid #f0f0f0;">1</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Tom Wilson</td><td style="padding:8px; border:1px solid #f0f0f0;">4</td><td style="padding:8px; border:1px solid #f0f0f0;">0</td></tr>
                </table>`
        },
        {
            id: 'att_summary_today',
            section: 'Daily Clock-In & Attendance',
            order: 8,
            question: "Show today's attendance summary.",
            icon: '📊',
            keywords: ["attendance summary", "today's attendance"],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b style="color:#22c55e;">✅ Present:</b> 18 of 22 (81.8%)<br>
                    <b style="color:#dc2626;">❌ Absent:</b> 2<br>
                    <b style="color:#f59e0b;">⚠ Late:</b> 2<br>
                    <b style="color:#3b82f6;">📴 Scheduled OFF:</b> 0
                </div>`
        },
        {
            id: 'att_count_on_clock',
            section: 'Daily Clock-In & Attendance',
            order: 9,
            question: 'How many employees are currently on the clock?',
            icon: '🕐',
            keywords: ['currently on the clock', 'how many employees are on the clock', 'on the clock right now'],
            body: `<b style="color:#22c55e; font-size:16px;">14</b> of 22 active employees are currently clocked in.`
        },
        {
            id: 'att_unauthorized_location',
            section: 'Daily Clock-In & Attendance',
            order: 10,
            question: 'Which employees clocked in from an unauthorized location?',
            icon: '📍',
            keywords: ['unauthorized location', 'clocked in from outside', 'geofence', 'outside the store'],
            body: `<b style="color:#dc2626;">1 flagged clock-in outside the store geofence:</b><br>
                <div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Tom Wilson</b> — Clocked in 0.6 mi from Store #{STORE} at 2:03 PM <span style="color:#dc2626;">(flagged)</span>
                </div><br>
                <span style="color:#2563eb;">💡 Review and approve or reject this punch in the Time Clock module.</span>`
        },
        {
            id: 'att_most_late_arrivals',
            section: 'Daily Clock-In & Attendance',
            order: 11,
            question: 'Who has the highest number of late arrivals?',
            icon: '🏆',
            keywords: ['highest number of late arrivals', 'most late arrivals', 'most frequently late'],
            body: `<b>Lisa Brown</b> has the most late arrivals this month — <b style="color:#dc2626;">8 times</b>, averaging 14 minutes late per occurrence.`
        },
        {
            id: 'att_no_punches',
            section: 'Daily Clock-In & Attendance',
            order: 12,
            question: 'Which employees have no punches today?',
            icon: '❓',
            keywords: ['no punches today', 'no time punches', 'have no punches'],
            body: `<b style="color:#dc2626;">1 scheduled employee has no punches recorded today:</b><br>
                <div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Lisa Brown</b> — Scheduled 8:00 AM – 4:00 PM, no clock-in and no clock-out.
                </div>`
        },
        {
            id: 'att_absent_today',
            section: 'Daily Clock-In & Attendance',
            order: 13,
            question: "Show today's absent employees.",
            icon: '❌',
            keywords: ["absent employees", "who is absent", "who's absent"],
            body: `<b style="color:#dc2626;">2 employees are absent today:</b><br>
                <div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • <b>Lisa Brown</b> — No-show (Cashier, 8:00 AM – 4:00 PM)<br>
                    • <b>James Parker</b> — Called out sick (approved)
                </div>`
        },
        {
            id: 'cov_dept_understaffed',
            section: 'Daily Clock-In & Attendance',
            order: 14,
            question: 'Which departments are understaffed right now?',
            icon: '⚠️',
            keywords: ['departments are understaffed', 'department understaffed'],
            body: `<b style="color:#dc2626;">Kitchen</b> is understaffed right now — 2 staff on, 3 recommended for this hour.<br>
                All other departments are at or above target coverage.`
        },
        {
            id: 'att_late_over_15',
            section: 'Daily Clock-In & Attendance',
            order: 15,
            question: 'How many employees arrived more than 15 minutes late?',
            icon: '⏰',
            keywords: ['more than 15 minutes late', 'over 15 minutes late', '15 minutes late'],
            body: `<b style="color:#f59e0b;">1 employee</b> arrived more than 15 minutes late today:<br>
                <div style="margin:8px 0; font-size:13px;"><b>Mark Johnson</b> — 18 minutes late (6:00 AM shift)</div>`
        },
        {
            id: 'att_clocked_in_before_scheduled',
            section: 'Daily Clock-In & Attendance',
            order: 16,
            question: 'Show employees who clocked in before their scheduled time.',
            icon: '⏱️',
            keywords: ['before their scheduled time', 'before scheduled start', 'clocked in before schedule'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • <b>Rachel Green</b> — 10 min before scheduled start<br>
                    • <b>David Chen</b> — 15 min before scheduled start<br>
                    • <b>Sarah Mitchell</b> — 15 min before scheduled start
                </div>`
        },
        {
            id: 'att_unscheduled_worked',
            section: 'Daily Clock-In & Attendance',
            order: 17,
            question: 'Who worked without being scheduled?',
            icon: '🔍',
            keywords: ['without being scheduled', 'worked unscheduled', 'not scheduled but worked'],
            body: `<b style="color:#f59e0b;">1 employee</b> clocked in without a matching schedule entry:<br>
                <div style="margin:8px 0; font-size:13px;"><b>David Chen</b> — Clocked in 9:00 AM–1:00 PM, no shift found on the schedule for today.</div><br>
                <span style="color:#2563eb;">💡 Confirm this was an approved cover shift, or flag it for review.</span>`
        },
        {
            id: 'att_incomplete_punches',
            section: 'Daily Clock-In & Attendance',
            order: 18,
            question: 'Which employees have incomplete punches?',
            icon: '⚠️',
            keywords: ['incomplete punches', 'missing punch', 'punch missing'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • <b>James Parker</b> — Missing clock-out (yesterday, 6:00 AM shift)<br>
                    • <b>Maria Gonzalez</b> — Missing clock-out (yesterday, 2:00 PM shift)
                </div>`
        },
        {
            id: 'att_no_shows_count',
            section: 'Daily Clock-In & Attendance',
            order: 19,
            question: 'How many no-shows do we have today?',
            icon: '🚫',
            keywords: ['no-shows do we have', 'how many no-shows', 'no shows today'],
            body: `<b style="color:#dc2626; font-size:16px;">1</b> no-show today — <b>Lisa Brown</b> (Cashier, 8:00 AM – 4:00 PM).`
        },
        {
            id: 'att_percentage_today',
            section: 'Daily Clock-In & Attendance',
            order: 20,
            question: 'Show attendance percentage for today.',
            icon: '📈',
            keywords: ['attendance percentage'],
            body: `<b style="color:#22c55e; font-size:16px;">81.8%</b> attendance today (18 of 22 scheduled employees present).`
        },
        {
            id: 'sch_leaving_next_hour',
            section: 'Shift Monitoring',
            order: 21,
            question: 'Who is scheduled to leave in the next hour?',
            icon: '🚪',
            keywords: ['leave in the next hour', 'leaving in the next hour', 'ending shift soon'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • <b>Rachel Green</b> — Shift ends 3:00 PM (Shift Lead)<br>
                    • <b>David Chen</b> — Shift ends 3:15 PM (Cook)
                </div><br>
                <span style="color:#2563eb;">💡 Confirm relief coverage is in place before they leave.</span>`
        },
        {
            id: 'cov_shifts_understaffed',
            section: 'Shift Monitoring',
            order: 22,
            question: 'Which shifts are currently understaffed?',
            icon: '⚠️',
            keywords: ['shifts are currently understaffed', 'understaffed shifts'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • <b>2:00 PM – 6:00 PM (Kitchen)</b> — 2 on, needs 3<br>
                    • <b>6:00 PM – 9:00 PM (Front Counter)</b> — 2 on, needs 3
                </div>`
        },
        {
            id: 'sch_overlapping_shifts',
            section: 'Shift Monitoring',
            order: 23,
            question: 'Show overlapping shifts.',
            icon: '🔀',
            keywords: ['overlapping shifts', 'shifts overlap'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Sarah Mitchell</b> & <b>David Chen</b> — both scheduled 2:00 PM – 4:00 PM as Shift Lead<br>
                </div><br>
                <span style="color:#2563eb;">💡 One of these can likely be reassigned to cover the 6 PM gap instead.</span>`
        },
        {
            id: 'att_worked_beyond_end',
            section: 'Shift Monitoring',
            order: 24,
            question: 'Which employees have worked beyond their scheduled end time?',
            icon: '⏳',
            keywords: ['beyond their scheduled end time', 'worked past scheduled end', 'still clocked in past shift end'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Rachel Green</b> — Scheduled to end 2:00 PM, still clocked in (34 min over)
                </div>`
        },
        {
            id: 'sch_nearing_overtime',
            section: 'Shift Monitoring',
            order: 25,
            question: 'Show employees nearing overtime.',
            icon: '⚠️',
            keywords: ['nearing overtime', 'approaching overtime', 'close to overtime'],
            body: `<div style="margin:8px 0 12px 8px; font-size:13px; line-height:1.9;">
                    • <b>James Parker</b> — 38.5 hrs (1.5 hrs until OT)<br>
                    • <b>Maria Gonzalez</b> — 39.0 hrs (1.0 hrs until OT)
                </div>`
        },
        {
            id: 'att_worked_over_8hrs',
            section: 'Shift Monitoring',
            order: 26,
            question: 'Who has worked more than 8 hours today?',
            icon: '⏱️',
            keywords: ['worked more than 8 hours', 'over 8 hours today', 'more than 8 hours today'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Kevin Lee</b> — 8.6 hrs so far today <span style="color:#dc2626;">(0.6 hrs into OT)</span>
                </div>`
        },
        {
            id: 'sch_open_positions',
            section: 'Shift Monitoring',
            order: 27,
            question: 'Which shifts have open positions?',
            icon: '📭',
            keywords: ['shifts have open positions', 'open positions', 'open shifts'],
            body: `<b style="color:#dc2626;">2 open shifts</b> this week:<br>
                <div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • Sat, May 10 — 8:00 AM – 4:00 PM (Cook)<br>
                    • Sun, May 11 — 11:00 AM – 7:00 PM (Cashier)
                </div>`
        },
        {
            id: 'cov_today_coverage',
            section: 'Shift Monitoring',
            order: 28,
            question: "Show today's shift coverage.",
            icon: '👥',
            keywords: ["today's shift coverage", "shift coverage today"],
            body: `<b style="color:#10b981;">✓ Well Covered:</b> 78%<br>
                <b style="color:#f59e0b;">⚠ Partially Covered:</b> 18%<br>
                <b style="color:#dc2626;">✗ Understaffed:</b> 4%`
        },
        {
            id: 'cov_kitchen_positions',
            section: 'Shift Monitoring',
            order: 29,
            question: 'Are all kitchen positions covered?',
            icon: '🍳',
            keywords: ['kitchen positions covered', 'kitchen covered', 'kitchen fully staffed'],
            body: `<b style="color:#dc2626;">No —</b> Kitchen is short 1 position right now (2 on, 3 needed for this hour).`
        },
        {
            id: 'cov_cashiers_lunch',
            section: 'Shift Monitoring',
            order: 30,
            question: 'Are enough cashiers working during lunch?',
            icon: '🍽️',
            keywords: ['cashiers working during lunch', 'enough cashiers', 'cashier coverage lunch'],
            body: `<b style="color:#22c55e;">Yes —</b> 3 cashiers are scheduled 12:00 PM – 2:00 PM, matching forecasted lunch demand.`
        },
        {
            id: 'sch_double_shifts',
            section: 'Shift Monitoring',
            order: 31,
            question: 'Which employees are working double shifts?',
            icon: '🔁',
            keywords: ['working double shifts', 'double shift'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Kevin Lee</b> — 6:00 AM – 2:00 PM, then 4:00 PM – 10:00 PM (double shift today)
                </div>`
        },
        {
            id: 'sch_split_shifts',
            section: 'Shift Monitoring',
            order: 32,
            question: 'Show employees with split shifts.',
            icon: '✂️',
            keywords: ['split shifts', 'split shift'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Maria Gonzalez</b> — 11:00 AM – 2:00 PM and 5:00 PM – 8:00 PM (split shift)
                </div>`
        },
        {
            id: 'cov_highest_labor_cost',
            section: 'Shift Monitoring',
            order: 33,
            question: 'Which shift has the highest labor cost today?',
            icon: '💰',
            keywords: ['highest labor cost', 'most expensive shift'],
            body: `<b>4:00 PM – 10:00 PM</b> has the highest labor cost today at <b>$412.50</b> (7 employees, incl. 1.5 OT hrs).`
        },
        {
            id: 'sch_shift_timeline',
            section: 'Shift Monitoring',
            order: 34,
            question: "Show today's shift timeline.",
            icon: '🗓️',
            keywords: ['shift timeline', 'timeline for today', "today's shifts timeline"],
            body: `<table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Time</td><td style="padding:8px; border:1px solid #e5e7eb;">Staff On</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">6 AM – 10 AM</td><td style="padding:8px; border:1px solid #f0f0f0;">4</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">10 AM – 2 PM</td><td style="padding:8px; border:1px solid #f0f0f0;">7</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">2 PM – 6 PM</td><td style="padding:8px; border:1px solid #f0f0f0;">6</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">6 PM – 10 PM</td><td style="padding:8px; border:1px solid #f0f0f0;">7</td></tr>
                </table>`
        },
        {
            id: 'cov_shifts_overstaffed',
            section: 'Shift Monitoring',
            order: 35,
            question: 'Which shifts are overstaffed?',
            icon: '📈',
            keywords: ['shifts are overstaffed', 'overstaffed'],
            body: `<b>10:00 AM – 12:00 PM</b> is overstaffed — 6 staff on, 4 recommended for forecasted traffic.`
        },
        {
            id: 'cov_dinner_rush',
            section: 'Shift Monitoring',
            order: 36,
            question: 'Are there enough employees for dinner rush?',
            icon: '🍽️',
            keywords: ['dinner rush', 'enough employees for dinner'],
            body: `<b style="color:#f59e0b;">Borderline —</b> 6 staff scheduled 5:00 PM – 8:00 PM against a forecasted need of 7. Consider adding 1 more.`
        },
        {
            id: 'sch_swapped_shifts',
            section: 'Shift Monitoring',
            order: 37,
            question: 'Which employees swapped shifts this week?',
            icon: '🔄',
            keywords: ['swapped shifts this week', 'shift swap'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Tom Wilson</b> ↔ <b>Kevin Lee</b> — swapped Thu 2 PM–10 PM shift (approved)
                </div>`
        },
        {
            id: 'sch_changes_approved',
            section: 'Shift Monitoring',
            order: 38,
            question: 'Show shift changes approved today.',
            icon: '✅',
            keywords: ['shift changes approved today', 'approved shift changes'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • <b>Rachel Green</b> — Start time moved 10:00 AM → 9:30 AM (approved by manager)<br>
                    • <b>Tom Wilson</b> — Picked up open Sat shift (8:00 AM – 4:00 PM)
                </div>`
        },
        {
            id: 'att_scheduled_not_arrived',
            section: 'Shift Monitoring',
            order: 39,
            question: "Which scheduled employees haven't arrived?",
            icon: '⏳',
            keywords: ["scheduled employees haven't arrived", "haven't arrived yet", "not arrived yet"],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • <b>Tom Wilson</b> — Scheduled 2:00 PM, not yet arrived (12 min late)<br>
                    • <b>Kevin Lee</b> — Scheduled 2:00 PM, not yet arrived (12 min late)
                </div>`
        },
        {
            id: 'sch_replacing_absent',
            section: 'Shift Monitoring',
            order: 40,
            question: 'Who is replacing absent employees today?',
            icon: '🔁',
            keywords: ['replacing absent employees', 'covering for absent', 'who is covering for'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>David Chen</b> is covering <b>Lisa Brown's</b> 8:00 AM – 4:00 PM Cashier shift (assigned 8:10 AM).
                </div>`
        }
    );
})();
