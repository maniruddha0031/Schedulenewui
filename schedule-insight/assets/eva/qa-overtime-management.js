// Q&A data batch: Overtime Management (41-60)
// Same shape as data/qa-attendance-scheduling.js — see that file's header comment for details.
(function () {
    window.qaDatabase = window.qaDatabase || [];

    window.qaDatabase.push(
        {
            id: 'ot_hit_today',
            section: 'Overtime Management',
            order: 41,
            question: 'Who will hit overtime today?',
            icon: '⚠️',
            keywords: ['will hit overtime today', 'hit overtime today'],
            body: `<b>Kevin Lee</b> is on track to hit overtime today — projected <b style="color:#dc2626;">8.6 hrs</b> by clock-out (0.6 hrs into OT).`
        },
        {
            id: 'ot_exceeded_weekly',
            section: 'Overtime Management',
            order: 42,
            question: 'Which employees exceeded weekly overtime?',
            icon: '⚠️',
            keywords: ['exceeded weekly overtime', 'exceeded overtime'],
            body: `<b>Kevin Lee</b> exceeded weekly overtime — <b style="color:#dc2626;">41.5 hrs</b> (1.5 hrs over the 40-hr threshold).`
        },
        {
            id: 'ot_accumulated_week',
            section: 'Overtime Management',
            order: 43,
            question: 'How much overtime have we accumulated this week?',
            icon: '🕐',
            keywords: ['overtime have we accumulated', 'accumulated this week', 'overtime this week'],
            body: `<b style="color:#f59e0b; font-size:16px;">12.5 hrs</b> of overtime accumulated this week, costing an estimated <b>$468.75</b>.`
        },
        {
            id: 'ot_projected_friday',
            section: 'Overtime Management',
            order: 44,
            question: 'Show projected overtime by Friday.',
            icon: '📈',
            keywords: ['projected overtime', 'overtime by friday'],
            body: `Projected <b>15.5 OT hrs</b> by Friday if the current pace continues (~<b>$581</b> in OT cost).`
        },
        {
            id: 'ot_reduce_today',
            section: 'Overtime Management',
            order: 45,
            question: "How can I reduce today's overtime?",
            icon: '💡',
            keywords: ['reduce today\'s overtime', 'reduce overtime today'],
            body: `<span style="color:#2563eb;">💡 Move Kevin Lee's last 1.5 hrs to David Chen</span>, who is under 30 hrs this week and has room before hitting overtime.`
        },
        {
            id: 'ot_dept_most',
            section: 'Overtime Management',
            order: 46,
            question: 'Which departments generate the most overtime?',
            icon: '🍳',
            keywords: ['departments generate the most overtime', 'department generates the most overtime'],
            body: `<b>Kitchen</b> generates the most overtime — 7.5 of this week's 12.5 OT hrs (60%).`
        },
        {
            id: 'ot_unauthorized',
            section: 'Overtime Management',
            order: 47,
            question: 'Show unauthorized overtime.',
            icon: '🚫',
            keywords: ['unauthorized overtime'],
            body: `<b style="color:#dc2626;">1 unauthorized OT punch:</b> Kevin Lee clocked 1.5 hrs past shift end without manager approval.`
        },
        {
            id: 'ot_consistent',
            section: 'Overtime Management',
            order: 48,
            question: 'Which employees consistently work overtime?',
            icon: '🔁',
            keywords: ['consistently work overtime', 'consistently overtime'],
            body: `<b>Kevin Lee</b> and <b>James Parker</b> have logged overtime in 3 of the last 4 weeks.`
        },
        {
            id: 'ot_compare_last_week',
            section: 'Overtime Management',
            order: 49,
            question: 'Compare overtime with last week.',
            icon: '📊',
            keywords: ['compare overtime with last week', 'overtime vs last week'],
            body: `<b>12.5 hrs</b> this week vs <b>9.0 hrs</b> last week — <span style="color:#dc2626;">up 39%</span>.`
        },
        {
            id: 'ot_cost_today',
            section: 'Overtime Management',
            order: 50,
            question: "What's today's overtime cost?",
            icon: '💰',
            keywords: ["today's overtime cost", 'overtime cost today'],
            body: `<b style="color:#f59e0b;">~$13.50</b> accrued so far today — Kevin Lee is 0.6 hrs into overtime.`
        },
        {
            id: 'ot_closest',
            section: 'Overtime Management',
            order: 51,
            question: 'Which employees are closest to overtime?',
            icon: '⚠️',
            keywords: ['closest to overtime'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    • <b>James Parker</b> — 38.5 hrs (1.5 hrs until OT)<br>
                    • <b>Maria Gonzalez</b> — 39.0 hrs (1.0 hrs until OT)
                </div>`
        },
        {
            id: 'ot_suggest_replacements',
            section: 'Overtime Management',
            order: 52,
            question: 'Suggest replacements to avoid overtime.',
            icon: '💡',
            keywords: ['suggest replacements', 'replacements to avoid overtime'],
            body: `<span style="color:#2563eb;">💡 Swap David Chen in for Kevin Lee's last hour</span> today to avoid pushing him further into overtime.`
        },
        {
            id: 'ot_managers_approved',
            section: 'Overtime Management',
            order: 53,
            question: 'Which managers approved overtime?',
            icon: '✅',
            keywords: ['managers approved overtime'],
            body: `<b>Angela Reyes</b> (Store Manager) approved 2 overtime shifts this week.`
        },
        {
            id: 'ot_trends_month',
            section: 'Overtime Management',
            order: 54,
            question: 'Show overtime trends over the last month.',
            icon: '📈',
            keywords: ['overtime trends', 'trends over the last month'],
            body: `<table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Week</td><td style="padding:8px; border:1px solid #e5e7eb;">OT Hours</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">3 weeks ago</td><td style="padding:8px; border:1px solid #f0f0f0;">7.0</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">2 weeks ago</td><td style="padding:8px; border:1px solid #f0f0f0;">8.5</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Last week</td><td style="padding:8px; border:1px solid #f0f0f0;">9.0</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">This week</td><td style="padding:8px; border:1px solid #f0f0f0; color:#dc2626;"><b>12.5</b></td></tr>
                </table>`
        },
        {
            id: 'ot_percentage',
            section: 'Overtime Management',
            order: 55,
            question: 'What is our overtime percentage?',
            icon: '📊',
            keywords: ['overtime percentage'],
            body: `<b style="color:#f59e0b; font-size:16px;">4.0%</b> of total hours this week were overtime (12.5 of 312.5 hrs).`
        },
        {
            id: 'ot_highest_store',
            section: 'Overtime Management',
            order: 56,
            question: 'Which store has the highest overtime?',
            icon: '🏆',
            keywords: ['store has the highest overtime'],
            body: `<b>Store #10002 – Mississauga Center</b> has the highest overtime this week at <b>18.0 hrs</b>.`
        },
        {
            id: 'ot_by_position',
            section: 'Overtime Management',
            order: 57,
            question: 'Show overtime by position.',
            icon: '📋',
            keywords: ['overtime by position'],
            body: `<table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Position</td><td style="padding:8px; border:1px solid #e5e7eb;">OT Hours</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Cook</td><td style="padding:8px; border:1px solid #f0f0f0;">7.5</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Shift Lead</td><td style="padding:8px; border:1px solid #f0f0f0;">3.0</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Cashier</td><td style="padding:8px; border:1px solid #f0f0f0;">2.0</td></tr>
                </table>`
        },
        {
            id: 'ot_by_department',
            section: 'Overtime Management',
            order: 58,
            question: 'Show overtime by department.',
            icon: '📋',
            keywords: ['overtime by department'],
            body: `<table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Department</td><td style="padding:8px; border:1px solid #e5e7eb;">OT Hours</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Kitchen</td><td style="padding:8px; border:1px solid #f0f0f0;">7.5</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Front-of-House</td><td style="padding:8px; border:1px solid #f0f0f0;">3.5</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Management</td><td style="padding:8px; border:1px solid #f0f0f0;">1.5</td></tr>
                </table>`
        },
        {
            id: 'ot_exceptions',
            section: 'Overtime Management',
            order: 59,
            question: 'Which employees have overtime exceptions?',
            icon: '⚠️',
            keywords: ['overtime exceptions'],
            body: `<b style="color:#dc2626;">1 exception:</b> Kevin Lee's overtime punch is missing manager sign-off.`
        },
        {
            id: 'ot_predict_next_week',
            section: 'Overtime Management',
            order: 60,
            question: 'Predict overtime for next week.',
            icon: '🔮',
            keywords: ['predict overtime', 'overtime for next week'],
            body: `Predicted <b>10–13 OT hrs</b> next week based on the current schedule and recent trend.`
        }
    );
})();
