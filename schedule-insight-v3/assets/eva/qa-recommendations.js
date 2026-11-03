// Q&A data batch: Recommendation Questions (131-150)
// Same shape as data/qa-attendance-scheduling.js — see that file's header comment for details.
(function () {
    window.qaDatabase = window.qaDatabase || [];

    window.qaDatabase.push(
        {
            id: 'rec_reduce_now',
            section: 'Recommendation Questions',
            order: 131,
            question: 'What should I do right now to reduce labor cost?',
            icon: '💡',
            keywords: ['right now to reduce labor cost'],
            body: `<span style="color:#2563eb;">💡 Send David Chen home 30 min early</span> — the 10 AM–12 PM window is overstaffed by 2.`
        },
        {
            id: 'rec_send_home_early',
            section: 'Recommendation Questions',
            order: 132,
            question: 'Can I send someone home early?',
            icon: '💡',
            keywords: ['send someone home early'],
            body: `<b style="color:#22c55e;">Yes —</b> David Chen or Sarah Mitchell can leave 30 min early without dropping below target coverage.`
        },
        {
            id: 'rec_who_to_call_in',
            section: 'Recommendation Questions',
            order: 133,
            question: 'Which employee should I call in today?',
            icon: '📞',
            keywords: ['employee should i call in today', 'call in today'],
            body: `<b>Rachel Green</b> — available and has covered dinner shifts before; would close the 5–8 PM gap.`
        },
        {
            id: 'rec_next_2_hours',
            section: 'Recommendation Questions',
            order: 134,
            question: 'Recommend staffing changes for the next 2 hours.',
            icon: '💡',
            keywords: ['staffing changes for the next 2 hours'],
            body: `Add 1 staff at 6 PM for the dinner rush, and consider releasing 1 staff from the 4 PM lull.`
        },
        {
            id: 'rec_extend_shifts',
            section: 'Recommendation Questions',
            order: 135,
            question: 'Suggest employees to extend shifts.',
            icon: '💡',
            keywords: ['employees to extend shifts'],
            body: `<b>Rachel Green</b> could extend by 2 hrs — she's at 32 hrs this week, well under 40.`
        },
        {
            id: 'rec_shorten_shifts',
            section: 'Recommendation Questions',
            order: 136,
            question: 'Suggest employees to shorten shifts.',
            icon: '💡',
            keywords: ['employees to shorten shifts'],
            body: `<b>Kevin Lee</b> — trimming 1.5 hrs today keeps him out of overtime.`
        },
        {
            id: 'rec_best_to_cover',
            section: 'Recommendation Questions',
            order: 137,
            question: 'Which employees are best suited to cover a shift?',
            icon: '⭐',
            keywords: ['best suited to cover a shift'],
            body: `<b>David Chen</b> (Kitchen) and <b>Sarah Mitchell</b> (Front Counter) are cross-trained and currently available.`
        },
        {
            id: 'rec_avoid_overtime_changes',
            section: 'Recommendation Questions',
            order: 138,
            question: 'Recommend schedule changes to avoid overtime.',
            icon: '💡',
            keywords: ['schedule changes to avoid overtime'],
            body: `Swap 1.5 hrs of Kevin Lee's Thursday shift to David Chen, who has hours to spare this week.`
        },
        {
            id: 'rec_improve_productivity',
            section: 'Recommendation Questions',
            order: 139,
            question: 'How can I improve labor productivity today?',
            icon: '💡',
            keywords: ['improve labor productivity today'],
            body: `Rebalance the 10 AM overstaffing toward the 6 PM rush to lift sales-per-labor-hour.`
        },
        {
            id: 'rec_reduce_payroll_errors',
            section: 'Recommendation Questions',
            order: 140,
            question: 'Suggest actions to reduce payroll errors.',
            icon: '💡',
            keywords: ['reduce payroll errors'],
            body: `Enable break reminders and require manager approval for edits over 15 min to cut down on corrections.`
        },
        {
            id: 'rec_resolve_first',
            section: 'Recommendation Questions',
            order: 141,
            question: 'Which attendance issues should I resolve first?',
            icon: '⚠️',
            keywords: ['attendance issues should i resolve first'],
            body: `Start with <b>Lisa Brown</b> — 8 lates and 3 no-shows this month, the most severe pattern on the team.`
        },
        {
            id: 'rec_compliance_risks',
            section: 'Recommendation Questions',
            order: 142,
            question: 'What compliance risks exist today?',
            icon: '🚨',
            keywords: ['compliance risks exist today'],
            body: `<b>Tom Wilson's</b> 6-hr shift with no logged break is the top compliance risk today.`
        },
        {
            id: 'rec_stores_need_attention',
            section: 'Recommendation Questions',
            order: 143,
            question: 'Which stores need management attention?',
            icon: '⚠️',
            keywords: ['stores need management attention'],
            body: `<b>Store #10002 – Mississauga Center</b> — highest overtime and lowest attendance this week.`
        },
        {
            id: 'rec_staffing_tomorrow',
            section: 'Recommendation Questions',
            order: 144,
            question: 'Recommend staffing for tomorrow.',
            icon: '💡',
            keywords: ['recommend staffing for tomorrow'],
            body: `Schedule 18–20 staff tomorrow, with extra dinner-rush coverage between 5–8 PM.`
        },
        {
            id: 'rec_shortages_weekend',
            section: 'Recommendation Questions',
            order: 145,
            question: 'Predict labor shortages this weekend.',
            icon: '🔮',
            keywords: ['labor shortages this weekend'],
            body: `Saturday dinner (6–9 PM) is projected to be short 2 staff based on the current schedule vs forecast.`
        },
        {
            id: 'rec_unusual_patterns',
            section: 'Recommendation Questions',
            order: 146,
            question: 'Identify unusual attendance patterns.',
            icon: '🔍',
            keywords: ['unusual attendance patterns'],
            body: `Lisa Brown's late arrivals cluster on Mondays — 6 of her 8 lates this month happened on a Monday.`
        },
        {
            id: 'rec_savings_opportunities',
            section: 'Recommendation Questions',
            order: 147,
            question: 'Recommend labor savings opportunities.',
            icon: '💡',
            keywords: ['labor savings opportunities'],
            body: `Trimming the 10 AM overstaffing and capping Kevin Lee's overtime could save roughly $60/day.`
        },
        {
            id: 'rec_top_risks',
            section: 'Recommendation Questions',
            order: 148,
            question: "What are today's top operational risks?",
            icon: '🚨',
            keywords: ["today's top operational risks"],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    1) Kevin Lee is in overtime<br>
                    2) Dinner rush (5–8 PM) is understaffed<br>
                    3) Tom Wilson's shift has no logged break
                </div>`
        },
        {
            id: 'rec_key_insights',
            section: 'Recommendation Questions',
            order: 149,
            question: "Summarize today's key workforce insights.",
            icon: '📋',
            keywords: ["today's key workforce insights", 'key workforce insights'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Attendance:</b> 81.8%<br>
                    <b>Labor Cost:</b> $687.40 (16.2% of sales)<br>
                    <b>Overtime:</b> 1 employee in OT<br>
                    <b>Coverage Gap:</b> Dinner rush short 1 staff
                </div>`
        },
        {
            id: 'rec_before_closing',
            section: 'Recommendation Questions',
            order: 150,
            question: 'What should I focus on before closing the store?',
            icon: '✅',
            keywords: ['focus on before closing the store', 'before closing'],
            body: `Confirm Tom Wilson's break is logged, approve the pending clock-out corrections, and review tomorrow's open shifts.`
        }
    );
})();
