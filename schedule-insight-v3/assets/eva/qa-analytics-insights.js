// Q&A data batch: Analytics & Insights (101-130)
// Same shape as data/qa-attendance-scheduling.js — see that file's header comment for details.
(function () {
    window.qaDatabase = window.qaDatabase || [];

    window.qaDatabase.push(
        {
            id: 'ai_why_labor_higher',
            section: 'Analytics & Insights',
            order: 101,
            question: 'Why is labor cost higher today?',
            icon: '🔍',
            keywords: ['why is labor cost higher today'],
            body: `Kevin Lee's overtime (+$13.50) and an extra Kitchen shift for a catering order (+$96) are the main drivers today.`
        },
        {
            id: 'ai_caused_overtime',
            section: 'Analytics & Insights',
            order: 102,
            question: "What caused today's overtime?",
            icon: '🔍',
            keywords: ["what caused today's overtime", 'caused overtime'],
            body: `Kevin Lee's double shift (6 AM–2 PM, then 4 PM–10 PM) pushed him 1.5 hrs into overtime.`
        },
        {
            id: 'ai_attendance_problems',
            section: 'Analytics & Insights',
            order: 103,
            question: 'Which employees have attendance problems?',
            icon: '⚠️',
            keywords: ['employees have attendance problems'],
            body: `<b>Lisa Brown</b> (8 late, 3 no-shows) and <b>Mark Johnson</b> (5 late) need a conversation this month.`
        },
        {
            id: 'ai_best_attendance_store',
            section: 'Analytics & Insights',
            order: 104,
            question: 'Which store has the best attendance?',
            icon: '🏆',
            keywords: ['store has the best attendance'],
            body: `<b>Store #10001 – Westfield Mall</b> — 97.5% attendance this month.`
        },
        {
            id: 'ai_attendance_trends',
            section: 'Analytics & Insights',
            order: 105,
            question: 'Show attendance trends.',
            icon: '📈',
            keywords: ['attendance trends'],
            body: `Attendance has held steady around <b>81–84%</b> over the last 4 weeks, with Mondays consistently the weakest day.`
        },
        {
            id: 'ai_predict_staffing',
            section: 'Analytics & Insights',
            order: 106,
            question: "Predict tomorrow's staffing needs.",
            icon: '🔮',
            keywords: ["tomorrow's staffing needs", 'predict staffing'],
            body: `Forecast suggests <b>18–20 staff</b> needed tomorrow, similar to today, with extra coverage recommended for the dinner rush.`
        },
        {
            id: 'ai_labor_risks_today',
            section: 'Analytics & Insights',
            order: 107,
            question: 'What labor risks should I know today?',
            icon: '🚨',
            keywords: ['labor risks should i know', 'labor risks today'],
            body: `Two risks today: <b>Kevin Lee is in overtime</b>, and the <b>5–8 PM dinner rush is short 1 staff</b>.`
        },
        {
            id: 'ai_managers_most_exceptions',
            section: 'Analytics & Insights',
            order: 108,
            question: 'Which managers approve the most exceptions?',
            icon: '👤',
            keywords: ['managers approve the most exceptions'],
            body: `<b>Angela Reyes</b> approved 5 of this week's 7 exceptions.`
        },
        {
            id: 'ai_productivity_across_stores',
            section: 'Analytics & Insights',
            order: 109,
            question: 'Compare labor productivity across stores.',
            icon: '📊',
            keywords: ['labor productivity across stores'],
            body: `<table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Store</td><td style="padding:8px; border:1px solid #e5e7eb;">Sales / Labor Hr</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">#10001 Westfield Mall</td><td style="padding:8px; border:1px solid #f0f0f0;">$58.20</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">#99999 Downtown Toronto</td><td style="padding:8px; border:1px solid #f0f0f0;">$54.10</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">#10002 Mississauga Center</td><td style="padding:8px; border:1px solid #f0f0f0;">$47.80</td></tr>
                </table>`
        },
        {
            id: 'ai_most_efficient_depts',
            section: 'Analytics & Insights',
            order: 110,
            question: 'Which departments are most efficient?',
            icon: '⭐',
            keywords: ['departments are most efficient'],
            body: `<b>Front-of-House</b> — highest sales-per-labor-hour of any department this week.`
        },
        {
            id: 'ai_consistently_early',
            section: 'Analytics & Insights',
            order: 111,
            question: 'Which employees consistently arrive early?',
            icon: '⏱️',
            keywords: ['consistently arrive early'],
            body: `<b>Rachel Green</b> and <b>David Chen</b> — early on 90%+ of their shifts this month.`
        },
        {
            id: 'ai_often_miss_punches',
            section: 'Analytics & Insights',
            order: 112,
            question: 'Which employees often miss punches?',
            icon: '❓',
            keywords: ['often miss punches'],
            body: `<b>Lisa Brown</b> — 3 missed punches this month, the most of any employee.`
        },
        {
            id: 'ai_best_schedule_compliance',
            section: 'Analytics & Insights',
            order: 113,
            question: 'Which store has the best schedule compliance?',
            icon: '🏆',
            keywords: ['best schedule compliance'],
            body: `<b>Store #10001 – Westfield Mall</b> — 96% schedule adherence.`
        },
        {
            id: 'ai_productivity_by_hour',
            section: 'Analytics & Insights',
            order: 114,
            question: 'Show labor productivity by hour.',
            icon: '📊',
            keywords: ['labor productivity by hour'],
            body: `<table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Hour</td><td style="padding:8px; border:1px solid #e5e7eb;">Sales / Labor Hr</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">10 AM – 12 PM</td><td style="padding:8px; border:1px solid #f0f0f0; color:#dc2626;">$32.10</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">12 PM – 2 PM</td><td style="padding:8px; border:1px solid #f0f0f0;">$61.40</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">6 PM – 8 PM</td><td style="padding:8px; border:1px solid #f0f0f0;">$68.90</td></tr>
                </table>`
        },
        {
            id: 'ai_predict_next_week_ot',
            section: 'Analytics & Insights',
            order: 115,
            question: "Predict next week's overtime.",
            icon: '🔮',
            keywords: ["next week's overtime", 'predict next week overtime'],
            body: `Predicted <b>10–13 OT hrs</b> next week, similar to this week's pace.`
        },
        {
            id: 'ai_underutilized',
            section: 'Analytics & Insights',
            order: 116,
            question: 'Which employees are underutilized?',
            icon: '📉',
            keywords: ['employees are underutilized'],
            body: `<b>Maria Gonzalez</b> has averaged 22 hrs/week over the last month — below her 30-hr availability.`
        },
        {
            id: 'ai_overworked',
            section: 'Analytics & Insights',
            order: 117,
            question: 'Which employees are overworked?',
            icon: '⚠️',
            keywords: ['employees are overworked'],
            body: `<b>Kevin Lee</b> — 41.5 hrs this week and into overtime; consider capping his hours next week.`
        },
        {
            id: 'ai_vs_last_year',
            section: 'Analytics & Insights',
            order: 118,
            question: 'Compare labor cost with same day last year.',
            icon: '📊',
            keywords: ['same day last year'],
            body: `<b>$687.40</b> today vs <b>$612.80</b> same day last year — <span style="color:#dc2626;">up 12.2%</span>.`
        },
        {
            id: 'ai_trends_90_days',
            section: 'Analytics & Insights',
            order: 119,
            question: 'Show labor trends for the last 90 days.',
            icon: '📈',
            keywords: ['labor trends for the last 90 days', '90 days'],
            body: `Labor cost has risen gradually over the last 90 days (+6.8%), tracking closely with a similar rise in sales (+7.1%).`
        },
        {
            id: 'ai_need_optimization',
            section: 'Analytics & Insights',
            order: 120,
            question: 'Which stores need labor optimization?',
            icon: '⚠️',
            keywords: ['need labor optimization'],
            body: `<b>Store #10002 – Mississauga Center</b> — highest overtime and lowest labor efficiency score of the group.`
        },
        {
            id: 'ai_perfect_attendance',
            section: 'Analytics & Insights',
            order: 121,
            question: 'Which employees have perfect attendance?',
            icon: '⭐',
            keywords: ['perfect attendance'],
            body: `<b>Sarah Mitchell</b> and <b>David Chen</b> — zero late arrivals or no-shows this month.`
        },
        {
            id: 'ai_highest_absenteeism',
            section: 'Analytics & Insights',
            order: 122,
            question: 'Which stores have the highest absenteeism?',
            icon: '⚠️',
            keywords: ['highest absenteeism'],
            body: `<b>Store #10004 – Brampton Station</b> — 3 no-shows this month, the highest of any store.`
        },
        {
            id: 'ai_kpis_month',
            section: 'Analytics & Insights',
            order: 123,
            question: 'Show labor KPIs for this month.',
            icon: '📊',
            keywords: ['labor kpis'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Labor % of Sales:</b> 16.4%<br>
                    <b>Overtime %:</b> 4.0%<br>
                    <b>Attendance %:</b> 82.6%<br>
                    <b>Labor Efficiency Score:</b> 87/100
                </div>`
        },
        {
            id: 'ai_driving_payroll',
            section: 'Analytics & Insights',
            order: 124,
            question: "What's driving payroll increases?",
            icon: '🔍',
            keywords: ['driving payroll increases'],
            body: `Rising overtime hours (+39% week-over-week) and 2 recent wage increases are driving payroll up.`
        },
        {
            id: 'ai_most_violations_dept',
            section: 'Analytics & Insights',
            order: 125,
            question: 'Which departments have the most attendance violations?',
            icon: '⚠️',
            keywords: ['most attendance violations'],
            body: `<b>Kitchen</b> — 4 late arrivals and 1 no-show this month, the most of any department.`
        },
        {
            id: 'ai_vs_budget',
            section: 'Analytics & Insights',
            order: 126,
            question: 'How does labor compare with budget?',
            icon: '📊',
            keywords: ['labor compare with budget'],
            body: `<b style="color:#22c55e;">4.3% under</b> the weekly labor budget ($4,687.50 vs $4,900).`
        },
        {
            id: 'ai_productivity_vs_hours',
            section: 'Analytics & Insights',
            order: 127,
            question: 'Show productivity versus labor hours.',
            icon: '📈',
            keywords: ['productivity versus labor hours'],
            body: `Sales-per-labor-hour has climbed from $52 to $58 over the last 4 weeks as scheduling has tightened to forecast.`
        },
        {
            id: 'ai_metrics_attention',
            section: 'Analytics & Insights',
            order: 128,
            question: 'Which labor metrics require immediate attention?',
            icon: '🚨',
            keywords: ['labor metrics require immediate attention'],
            body: `<b>Overtime percentage</b> (4.0%, trending up) and <b>dinner-rush coverage</b> need attention today.`
        },
        {
            id: 'ai_recommendations_reduce_cost',
            section: 'Analytics & Insights',
            order: 129,
            question: 'What recommendations do you have to reduce labor costs?',
            icon: '💡',
            keywords: ['recommendations do you have to reduce labor costs'],
            body: `<span style="color:#2563eb;">💡 Cap Kevin Lee's hours to avoid overtime, and shift 1 staff from the 10 AM lull to the 6 PM rush.</span>`
        },
        {
            id: 'ai_summarize_workforce',
            section: 'Analytics & Insights',
            order: 130,
            question: "Summarize today's workforce performance.",
            icon: '📋',
            keywords: ["summarize today's workforce performance", 'workforce performance'],
            body: `<div style="margin:8px 0; font-size:13px; line-height:1.9;">
                    <b>Attendance:</b> 81.8% (18 of 22)<br>
                    <b>Labor Cost:</b> $687.40 so far (16.2% of sales)<br>
                    <b>Overtime:</b> Kevin Lee is 0.6 hrs into OT<br>
                    <b>Coverage:</b> Dinner rush (5–8 PM) is short 1 staff
                </div>`
        }
    );
})();
