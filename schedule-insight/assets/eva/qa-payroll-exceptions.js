// Q&A data batch: Payroll & Exceptions (81-100)
// Same shape as data/qa-attendance-scheduling.js — see that file's header comment for details.
(function () {
    window.qaDatabase = window.qaDatabase || [];

    window.qaDatabase.push(
        {
            id: 'pe_exceptions',
            section: 'Payroll & Exceptions',
            order: 81,
            question: 'Show payroll exceptions.',
            icon: '🧾',
            keywords: ['payroll exceptions'],
            body: `<b style="color:#f59e0b;">3 open exceptions:</b> 2 missing clock-outs, 1 unapproved overtime punch.`
        },
        {
            id: 'pe_need_approval',
            section: 'Payroll & Exceptions',
            order: 82,
            question: 'Which punches need manager approval?',
            icon: '✅',
            keywords: ['punches need manager approval'],
            body: `<b>2 punches</b> — James Parker's and Maria Gonzalez's missing clock-outs from yesterday.`
        },
        {
            id: 'pe_forgot_breaks',
            section: 'Payroll & Exceptions',
            order: 83,
            question: 'Which employees forgot meal breaks?',
            icon: '🍽️',
            keywords: ['forgot meal breaks', 'forgot their break'],
            body: `<b>Tom Wilson</b> worked a 6-hr shift with no logged meal break.`
        },
        {
            id: 'pe_break_violations',
            section: 'Payroll & Exceptions',
            order: 84,
            question: 'Show missing break violations.',
            icon: '⚠️',
            keywords: ['missing break violations', 'break violations'],
            body: `<b style="color:#dc2626;">1 violation:</b> Tom Wilson, 6-hr shift, no 30-min break recorded (state law requires one).`
        },
        {
            id: 'pe_no_break',
            section: 'Payroll & Exceptions',
            order: 85,
            question: 'Who worked without taking a break?',
            icon: '🍽️',
            keywords: ['worked without taking a break', 'without a break'],
            body: `<b>Tom Wilson</b> — 6 hrs straight with no break punch logged.`
        },
        {
            id: 'pe_manually_edited',
            section: 'Payroll & Exceptions',
            order: 86,
            question: 'Which punches were manually edited?',
            icon: '✏️',
            keywords: ['manually edited', 'punches were edited'],
            body: `<b>1 —</b> Sarah Mitchell's Tuesday clock-in was corrected from 10:08 AM to 10:00 AM by a manager.`
        },
        {
            id: 'pe_manager_overrides',
            section: 'Payroll & Exceptions',
            order: 87,
            question: 'Show all manager overrides.',
            icon: '🔧',
            keywords: ['manager overrides'],
            body: `<b>2 overrides</b> this week: 1 late clock-in waived, 1 missed clock-out corrected.`
        },
        {
            id: 'pe_duplicate_punches',
            section: 'Payroll & Exceptions',
            order: 88,
            question: 'Which employees have duplicate punches?',
            icon: '⚠️',
            keywords: ['duplicate punches'],
            body: `<b>David Chen</b> has a duplicate clock-in at 10:15 AM and 10:16 AM — needs cleanup before payroll.`
        },
        {
            id: 'pe_corrections_needed',
            section: 'Payroll & Exceptions',
            order: 89,
            question: 'Show payroll corrections needed.',
            icon: '🧾',
            keywords: ['payroll corrections needed', 'payroll corrections'],
            body: `<b>3 corrections pending:</b> 2 missing clock-outs, 1 duplicate punch.`
        },
        {
            id: 'pe_investigation',
            section: 'Payroll & Exceptions',
            order: 90,
            question: 'Which punches require investigation?',
            icon: '🔍',
            keywords: ['require investigation', 'punches to investigate'],
            body: `<b>Tom Wilson's</b> off-site clock-in (0.6 mi from the store) is flagged for review.`
        },
        {
            id: 'pe_pending_approvals',
            section: 'Payroll & Exceptions',
            order: 91,
            question: 'Show pending approvals.',
            icon: '⏳',
            keywords: ['pending approvals'],
            body: `<b>2 pending:</b> James Parker's and Maria Gonzalez's missing clock-out corrections.`
        },
        {
            id: 'pe_who_edited',
            section: 'Payroll & Exceptions',
            order: 92,
            question: 'Who edited employee timecards?',
            icon: '✏️',
            keywords: ['edited employee timecards', 'edited timecards'],
            body: `<b>Angela Reyes</b> (Store Manager) made 2 timecard edits this week.`
        },
        {
            id: 'pe_deleted_punches',
            section: 'Payroll & Exceptions',
            order: 93,
            question: 'Show deleted punches.',
            icon: '🗑️',
            keywords: ['deleted punches'],
            body: `<b>1 deleted punch</b> — a duplicate clock-in for David Chen was removed by the manager.`
        },
        {
            id: 'pe_exceeded_max_hours',
            section: 'Payroll & Exceptions',
            order: 94,
            question: 'Which employees exceeded maximum hours?',
            icon: '⚠️',
            keywords: ['exceeded maximum hours', 'maximum hours'],
            body: `<b>Kevin Lee</b> exceeded the 40-hr weekly maximum — currently at 41.5 hrs.`
        },
        {
            id: 'pe_policy_violations',
            section: 'Payroll & Exceptions',
            order: 95,
            question: 'Which punches violate company policy?',
            icon: '🚫',
            keywords: ['violate company policy', 'policy violation'],
            body: `<b>1 —</b> Tom Wilson's clock-in occurred outside the store geofence.`
        },
        {
            id: 'pe_summary_before_export',
            section: 'Payroll & Exceptions',
            order: 96,
            question: 'Show payroll summary before export.',
            icon: '📤',
            keywords: ['payroll summary before export', 'before export'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Total Hours:</b> 312.5 hrs<br>
                    <b>Total Payroll Cost:</b> $4,687.50<br>
                    <b>Overtime:</b> 12.5 hrs ($468.75)<br>
                    <b style="color:#f59e0b;">Open Exceptions:</b> 3 (resolve before export)
                </div>`
        },
        {
            id: 'pe_discrepancies',
            section: 'Payroll & Exceptions',
            order: 97,
            question: 'Are there any payroll discrepancies?',
            icon: '⚠️',
            keywords: ['payroll discrepancies'],
            body: `<b style="color:#f59e0b;">1 discrepancy —</b> David Chen's duplicate punch would overpay ~0.25 hrs if not corrected.`
        },
        {
            id: 'pe_highest_adjustments',
            section: 'Payroll & Exceptions',
            order: 98,
            question: 'Which employees have the highest payroll adjustments?',
            icon: '📊',
            keywords: ['highest payroll adjustments'],
            body: `<b>Kevin Lee</b> — +1.5 hrs overtime adjustment this week ($20.25).`
        },
        {
            id: 'pe_errors_by_store',
            section: 'Payroll & Exceptions',
            order: 99,
            question: 'Show payroll errors by store.',
            icon: '📋',
            keywords: ['payroll errors by store'],
            body: `<table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Store</td><td style="padding:8px; border:1px solid #e5e7eb;">Errors</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">#99999 Downtown Toronto</td><td style="padding:8px; border:1px solid #f0f0f0;">3</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">#10001 Westfield Mall</td><td style="padding:8px; border:1px solid #f0f0f0;">1</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">#10002 Mississauga Center</td><td style="padding:8px; border:1px solid #f0f0f0;">2</td></tr>
                </table>`
        },
        {
            id: 'pe_immediate_action',
            section: 'Payroll & Exceptions',
            order: 100,
            question: 'Which payroll items require immediate action?',
            icon: '🚨',
            keywords: ['require immediate action', 'immediate action'],
            body: `<b style="color:#dc2626;">2 items:</b> approve James Parker's and Maria Gonzalez's missing clock-outs before payroll locks tonight.`
        }
    );
})();
