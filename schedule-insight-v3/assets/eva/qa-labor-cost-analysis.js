// Q&A data batch: Labor Cost Analysis (61-80)
// Same shape as data/qa-attendance-scheduling.js — see that file's header comment for details.
(function () {
    window.qaDatabase = window.qaDatabase || [];

    window.qaDatabase.push(
        {
            id: 'lc_today',
            section: 'Labor Cost Analysis',
            order: 61,
            question: "What's today's labor cost?",
            icon: '💰',
            keywords: ["today's labor cost", 'labor cost today'],
            body: `<b style="color:#3b82f6; font-size:16px;">$687.40</b> so far today across 14 active employees.`
        },
        {
            id: 'lc_percent_sales',
            section: 'Labor Cost Analysis',
            order: 62,
            question: 'Labor cost as a percentage of sales?',
            icon: '📊',
            keywords: ['labor cost as a percentage of sales', 'labor percentage of sales'],
            body: `<b style="color:#22c55e; font-size:16px;">16.2%</b> of today's sales ($4,240) — within the 15–18% target range.`
        },
        {
            id: 'lc_vs_forecast',
            section: 'Labor Cost Analysis',
            order: 63,
            question: 'Compare labor cost with forecast.',
            icon: '📈',
            keywords: ['labor cost with forecast', 'labor cost vs forecast'],
            body: `<b>$687.40</b> actual vs <b>$712</b> forecasted — <span style="color:#22c55e;">3.5% under forecast</span>.`
        },
        {
            id: 'lc_over_budget',
            section: 'Labor Cost Analysis',
            order: 64,
            question: 'Are we over budget on labor?',
            icon: '💵',
            keywords: ['over budget on labor', 'over budget labor'],
            body: `<b style="color:#22c55e;">No —</b> $4,687.50 this week vs a $4,900 budget (4.3% under).`
        },
        {
            id: 'lc_highest_dept',
            section: 'Labor Cost Analysis',
            order: 65,
            question: 'Which department has the highest labor cost?',
            icon: '🍳',
            keywords: ['department has the highest labor cost'],
            body: `<b>Kitchen</b> — $1,950 this week (41.6% of total labor cost).`
        },
        {
            id: 'lc_hourly_today',
            section: 'Labor Cost Analysis',
            order: 66,
            question: 'Show hourly labor cost today.',
            icon: '🕐',
            keywords: ['hourly labor cost'],
            body: `<table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Hour</td><td style="padding:8px; border:1px solid #e5e7eb;">Cost</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">10 AM – 12 PM</td><td style="padding:8px; border:1px solid #f0f0f0;">$168</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">12 PM – 2 PM</td><td style="padding:8px; border:1px solid #f0f0f0;">$196</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">2 PM – 4 PM</td><td style="padding:8px; border:1px solid #f0f0f0;">$142</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">4 PM – present</td><td style="padding:8px; border:1px solid #f0f0f0;">$181.40</td></tr>
                </table>`
        },
        {
            id: 'lc_vs_yesterday',
            section: 'Labor Cost Analysis',
            order: 67,
            question: 'Compare labor cost with yesterday.',
            icon: '📊',
            keywords: ['labor cost with yesterday', 'labor cost vs yesterday'],
            body: `<b>$687.40</b> today vs <b>$652.10</b> yesterday — <span style="color:#dc2626;">up 5.4%</span>.`
        },
        {
            id: 'lc_vs_last_week',
            section: 'Labor Cost Analysis',
            order: 68,
            question: 'Compare labor cost with last week.',
            icon: '📊',
            keywords: ['labor cost with last week', 'labor cost vs last week'],
            body: `<b>$4,687.50</b> this week vs <b>$4,510</b> last week — <span style="color:#dc2626;">up 3.9%</span>.`
        },
        {
            id: 'lc_top_contributors',
            section: 'Labor Cost Analysis',
            order: 69,
            question: 'Which employees contribute the most labor cost?',
            icon: '👤',
            keywords: ['contribute the most labor cost'],
            body: `<b>Kevin Lee</b> — $612 this week (most hours worked, plus overtime).`
        },
        {
            id: 'lc_by_role',
            section: 'Labor Cost Analysis',
            order: 70,
            question: 'Show labor cost by job role.',
            icon: '📋',
            keywords: ['labor cost by job role', 'labor cost by role'],
            body: `<table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Role</td><td style="padding:8px; border:1px solid #e5e7eb;">Cost</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Cook</td><td style="padding:8px; border:1px solid #f0f0f0;">$1,950</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Cashier</td><td style="padding:8px; border:1px solid #f0f0f0;">$1,575</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">Management</td><td style="padding:8px; border:1px solid #f0f0f0;">$1,162.50</td></tr>
                </table>`
        },
        {
            id: 'lc_productive_percent',
            section: 'Labor Cost Analysis',
            order: 71,
            question: "What's today's productive labor percentage?",
            icon: '📊',
            keywords: ['productive labor percentage'],
            body: `<b style="color:#22c55e; font-size:16px;">91.2%</b> productive labor — 8.8% spent on non-revenue tasks (prep, cleaning).`
        },
        {
            id: 'lc_overstaffed_hours',
            section: 'Labor Cost Analysis',
            order: 72,
            question: 'Which hours are overstaffed?',
            icon: '📈',
            keywords: ['hours are overstaffed'],
            body: `<b>10 AM – 12 PM</b> is overstaffed by roughly 2 staff vs forecasted traffic.`
        },
        {
            id: 'lc_understaffed_hours',
            section: 'Labor Cost Analysis',
            order: 73,
            question: 'Which hours are understaffed?',
            icon: '⚠️',
            keywords: ['hours are understaffed'],
            body: `<b>5 PM – 8 PM</b> is understaffed by roughly 1 staff vs forecasted dinner traffic.`
        },
        {
            id: 'lc_save_today',
            section: 'Labor Cost Analysis',
            order: 74,
            question: 'How much labor can we save today?',
            icon: '💡',
            keywords: ['how much labor can we save'],
            body: `Trimming the 10 AM–12 PM overlap could save an estimated <b style="color:#22c55e;">$45</b> today.`
        },
        {
            id: 'lc_staffing_adjustments',
            section: 'Labor Cost Analysis',
            order: 75,
            question: 'Suggest staffing adjustments.',
            icon: '💡',
            keywords: ['suggest staffing adjustments'],
            body: `<span style="color:#2563eb;">💡 Move 1 staff from the 10 AM shift to cover the 6 PM dinner rush</span> — addresses both the overstaffing and the coverage gap.`
        },
        {
            id: 'lc_scheduled_vs_actual',
            section: 'Labor Cost Analysis',
            order: 76,
            question: 'Compare scheduled vs actual labor.',
            icon: '📊',
            keywords: ['scheduled vs actual labor'],
            body: `<b>312.5</b> scheduled hrs vs <b>308.0</b> actual hrs this week (<span style="color:#22c55e;">-1.4%</span>).`
        },
        {
            id: 'lc_efficiency_score',
            section: 'Labor Cost Analysis',
            order: 77,
            question: 'Show labor efficiency score.',
            icon: '⭐',
            keywords: ['labor efficiency score'],
            body: `<b style="color:#22c55e; font-size:16px;">87 / 100</b> — sales-per-labor-hour is trending above target this week.`
        },
        {
            id: 'lc_best_utilization',
            section: 'Labor Cost Analysis',
            order: 78,
            question: 'Which store has the best labor utilization?',
            icon: '🏆',
            keywords: ['best labor utilization'],
            body: `<b>Store #10001 – Westfield Mall</b> — 94% labor utilization this week.`
        },
        {
            id: 'lc_by_location',
            section: 'Labor Cost Analysis',
            order: 79,
            question: 'Compare labor cost by location.',
            icon: '📍',
            keywords: ['labor cost by location'],
            body: `<table style="width:100%; font-size:13px; border-collapse:collapse; margin:8px 0;">
                    <tr style="background:#f0f4ff; font-weight:600;"><td style="padding:8px; border:1px solid #e5e7eb;">Store</td><td style="padding:8px; border:1px solid #e5e7eb;">Labor Cost</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">#99999 Downtown Toronto</td><td style="padding:8px; border:1px solid #f0f0f0;">$4,687.50</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">#10001 Westfield Mall</td><td style="padding:8px; border:1px solid #f0f0f0;">$4,320.00</td></tr>
                    <tr><td style="padding:8px; border:1px solid #f0f0f0;">#10002 Mississauga Center</td><td style="padding:8px; border:1px solid #f0f0f0;">$5,110.00</td></tr>
                </table>`
        },
        {
            id: 'lc_why_higher',
            section: 'Labor Cost Analysis',
            order: 80,
            question: "Why is today's labor cost higher than normal?",
            icon: '🔍',
            keywords: ["today's labor cost higher", 'labor cost higher than normal'],
            body: `Kevin Lee's overtime (+$13.50) and an extra Kitchen shift added for a catering order (+$96) account for most of the increase.`
        }
    );
})();
