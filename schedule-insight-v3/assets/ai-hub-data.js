/* ============================================================
   AI Hub — Schedule KPI root-cause drilldown data.
   Rendered by ai-hub-render.js (every drilldown table is searchable).

   5 fixed schedule KPIs, all for ONE posted schedule so every number
   reconciles: Store 007 - Encinitas · week Mon 09/01 – Sun 09/07/2026.
   Figures are the Deep Dive's current week (deepdive-data.js):
     98 shifts · 656.34 sch hrs vs 551.15 forecast hrs · $12,210.48 sch $
     $55,480.82 forecast sales · forecast labor $10,260.34
     27.74 OT hrs / $853.30 (24 shifts, Sat + Sun)

   Rules and warning texts follow the Zip Schedule code (HW Release):
     - Labor %          laborCost (nor+OT+DT) ÷ forecast sales
     - Sch vs Fcst Hrs  schHrs − fctStaff, % = ÷ fctStaff
     - Efficiency       1 − (over + under hrs) ÷ sch hrs, measured per day
                        against ideal hours (forecast sales ÷ $89 target SPLH)
     - Overtime         daily OT > 8h (DOT), weekly > 40h (WOT), DT > 12h,
                        OT $ = OT hrs × rate × 1.5
     - Compliance       share of shifts with no schedule warning; warning
                        strings are the product's own (messages.json)
   Optional field: checks — rule checks [{lbl, v, ok}] (Compliance)
   ============================================================ */

const AHUB_KPI_DATA = [
  /* 1 ---------------------------------------------------------------- */
  {
    id:'schlabor', label:'Schedule Labor %', sbVal:'22.0%', sbVar:'▲ +3.5 pts', sev:'al', sbTgt:'Target 18.5% (forecast)',
    l1:{ eyebrow:'Schedule Labor % · Week of Sep 01 – Sep 07 · 007 - Encinitas', val:'22.0%', valCls:'al',
      chip:'▲ +3.5 pts above the forecast-supported 18.5%', chipCls:'al', tgt:'',
      stats:[{lbl:'Sch $',val:'$12,210.48',note:'Forecasted Sales $55,480.82',cls:'nm'},
             {lbl:'Budget (Hrs | %)',val:'596.44h | 20.00%',note:'Labor Budget % set by day',cls:'nm'},
             {lbl:'Variance (Hrs | %)',val:'−59.90h | −2.01%',note:'Over budget',cls:'al'},
             {lbl:'Sch Hrs vs Forecast Hrs',val:'656.34h',note:'Forecast Hrs 551.15h',cls:'wn'}]},
    segs:[
      {key:'wkend', lbl:'Weekend over-scheduling', pct:55, amt:'$1,068.38', ov:'+1.93 pts', ovCls:'al', col:'#1A3A6B'},
      {key:'ot', lbl:'Weekend OT premium', pct:14, amt:'$284.43', ov:'+0.51 pts', ovCls:'al', col:'#2E5FA3'},
      {key:'thu', lbl:'Thursday over-scheduling', pct:15, amt:'$288.76', ov:'+0.52 pts', ovCls:'wn', col:'#5680BC'},
      {key:'other', lbl:'Mon–Wed & Fri padding', pct:16, amt:'$308.56', ov:'+0.56 pts', ovCls:'nm', col:'#8AA8CC'},
    ],
    ai:'Schedule Labor % is <strong>22.0%, 3.5 pts above the 18.5%</strong> the forecast supports, which is <strong>$1,950</strong> of labor the forecast doesn\'t need. <strong>Saturday and Sunday account for $1,353 (69%)</strong>: weekend shifts are built 9–10 hours long, and 24 of them run into daily overtime. Thursday adds $289 more.',
    drivers:[
      { key:'wkend', n:1, sev:'al', seg:'wkend', icon:'calendar-clock', name:'Weekend shifts are scheduled 73 hours above forecast', sub:'Sat and Sun have 289.80 scheduled hours against 216.78 forecast. The average weekend shift is 8.52h, compared with 5.73h on weekdays.', impact:'+$1,068.38 regular pay', impCls:'al',
        insight:'<strong>Both weekend days are about 34% over forecast.</strong> Headcount is normal (17 shifts a day). The excess comes from shift length: the weekend template stretches almost every shift past 8 hours. On top of the regular hours, 24 of those shifts also pay daily overtime (see Schedule Overtime).',
        subs:[
          { name:'Weekend Scheduled vs Forecast',
            cols:['Date','Shifts','Shifts > 8 Hrs','Sch Hrs','Fcst Hrs','Variance','Fcst Sales','Sch $','Labor %','Excess $'],
            rows:[['Sat 09/06','17','12','145.01h','108.04h',{v:'+36.97h',c:'tc-al'},'$11,947.99','$2,690.52',{v:'22.5%',c:'tc-wn'},{v:'$688.34',c:'tc-al'}],
                  ['Sun 09/07','17','12','144.79h','108.74h',{v:'+36.05h',c:'tc-al'},'$11,200.86','$2,677.04',{v:'23.9%',c:'tc-al'},{v:'$664.47',c:'tc-al'}]]},
          { name:'Excess Labor $ by Role (whole week)',
            cols:['Role','Shifts','Sch Hrs','Fcst Hrs','Variance','Sch $','Excess $'],
            rows:[['General Manager','7','54.29h','46.13h',{v:'+8.16h',c:'tc-wn'},'$1,520.12',{v:'$228.48',c:'tc-wn'}],
                  ['Assistant Manager','9','74.49h','62.14h',{v:'+12.35h',c:'tc-wn'},'$1,713.27',{v:'$284.05',c:'tc-wn'}],
                  ['Shift Leader','14','99.14h','84.61h',{v:'+14.53h',c:'tc-wn'},'$1,933.23',{v:'$283.33',c:'tc-wn'}],
                  ['Line Cook','21','140.73h','116.62h',{v:'+24.11h',c:'tc-al'},'$2,392.41',{v:'$409.87',c:'tc-al'}],
                  ['Prep Cook','14','80.24h','68.85h',{v:'+11.39h',c:'tc-wn'},'$1,283.84',{v:'$182.24',c:'tc-wn'}],
                  ['GSA','24','152.14h','127.05h',{v:'+25.09h',c:'tc-al'},'$2,510.31',{v:'$413.99',c:'tc-al'}],
                  ['Dishwasher','9','55.31h','45.75h',{v:'+9.56h',c:'tc-wn'},'$857.31',{v:'$148.18',c:'tc-wn'}]]}
        ],
        fixRecs:['Rebuild the Sat/Sun template to 8-hour shifts. Cutting just the time past 8 hours removes 27.74h and $853.30, and the weekend is still 45 hours over forecast after that.',
                 'Then trim the remaining weekend excess, starting with Line Cook and GSA, which hold the most excess hours.']},
      { key:'ot', n:2, sev:'al', seg:'ot', icon:'alarm-clock', name:'Daily overtime on 24 weekend shifts adds a $284 premium', sub:'Every shift over 8 hours triggers California daily OT at 1.5x. The 0.5x premium on 27.74 OT hours costs $284.43.', impact:'+$284.43 OT premium', impCls:'al',
        insight:'<strong>All 27.74 OT hours this week are daily overtime on Saturday and Sunday.</strong> There is no weekly overtime: the highest weekly total is Priya Nair at 29.45h. Every OT hour comes from shift length, and none from how many shifts one person works.',
        subs:[{ name:'OT Premium by Day', cols:['Date','OT Shifts','OT Hrs','Regular Pay on OT Hrs','OT Pay (1.5x)','Premium (0.5x)'],
          rows:[['Sat 09/06','12','14.47h','$298.75','$448.13',{v:'$149.38',c:'tc-al'}],['Sun 09/07','12','13.27h','$270.11','$405.17',{v:'$135.05',c:'tc-al'}]]}],
        fixRecs:['Cap every weekend shift at 8 hours. See Schedule Overtime for each shift and the time to cut.']},
      { key:'thu', n:3, sev:'wn', seg:'thu', icon:'trending-up', name:'Thursday runs 25.1% labor, the highest day of the week', sub:'All 14 Thursday shifts run 15–25% over forecast, and an extra afternoon GSA adds a 6.95h closing shift.', impact:'+$288.76', impCls:'wn',
        insight:'<strong>Thursday\'s forecast sales ($6,560) are ordinary, but it has 89.06 scheduled hours against 73.48 forecast.</strong> Every shift carries about an hour of padding. Ava Thompson\'s extra 4:00–10:55 PM GSA shift goes past her availability (see Schedule Compliance).',
        subs:[{ name:'Thursday 09/04 by Role', cols:['Role','Shifts','Sch Hrs','Fcst Hrs','Extra vs Forecast','Sch $'],
          rows:[['General Manager','1','7.89h','6.39h',{v:'+1.50h',c:'tc-wn'},'$220.92'],['Assistant Manager','1','7.59h','6.30h',{v:'+1.29h',c:'tc-wn'},'$174.57'],['Shift Leader','2','13.72h','11.54h',{v:'+2.18h',c:'tc-wn'},'$267.54'],['Line Cook','3','17.44h','14.21h',{v:'+3.23h',c:'tc-wn'},'$296.48'],['Prep Cook','2','12.87h','10.59h',{v:'+2.28h',c:'tc-wn'},'$205.92'],['GSA','4','23.48h','19.34h',{v:'+4.14h',c:'tc-al'},'$387.44'],['Dishwasher','1','6.07h','5.11h',{v:'+0.96h',c:'tc-nm'},'$94.09']]}],
        fixRecs:['Drop the extra Thursday GSA closer and bring the other 13 shifts back to forecast length. That cuts about 15.6h and $289.']},
      { key:'other', n:4, sev:'info', seg:'other', icon:'circle-check', name:'Mon–Wed and Friday carry the usual template padding', sub:'+16.59h over forecast across four days. That\'s the same ~6–7% the store has run for the last 4 weeks.', impact:'+$308.56', impCls:'nm',
        insight:'These days aren\'t new. The store has scheduled 6.5–7.2% over forecast every week since mid-July. <strong>Monday is the exception worth a look:</strong> it has the lowest sales of the week ($5,895) but the same 13-shift template, so it runs 23.4% labor.',
        subs:[{ name:'Weekday Labor %', cols:['Date','Shifts','Sch Hrs','Fcst Hrs','Fcst Sales','Sch $','Labor %','Excess $'],
          rows:[['Mon 09/01','13','73.90h','69.99h','$5,895.42','$1,377.29',{v:'23.4%',c:'tc-al'},'$71.67'],['Tue 09/02','13','72.56h','67.84h','$6,668.78','$1,355.12',{v:'20.3%',c:'tc-wn'},'$88.74'],['Wed 09/03','13','71.28h','66.57h','$6,446.69','$1,331.50',{v:'20.7%',c:'tc-wn'},'$87.83'],['Fri 09/05','11','59.74h','56.49h','$6,760.94','$1,132.08',{v:'16.7%',c:'tc-gd'},'$60.32']]}]},
    ],
    recs:['Rebuild the Sat/Sun template to 8-hour shifts. That removes all 27.74 OT hours and $853.30 this week.',
          'Trim the remaining ~45 weekend hours above forecast, starting with Line Cook and GSA. That brings labor to about 19.6%.',
          'Remove the extra Thursday GSA closer and the hour of padding on every Thursday shift. Saves about $289.',
          'Cut Monday back to its forecast. It has the week\'s lowest sales and runs 23.4% labor.']
  },
  /* 2 ---------------------------------------------------------------- */
  {
    id:'schvsfcst', label:'Schedule vs Forecasted Hours', sbVal:'+105.19h', sbVar:'▲ +19.1%', sev:'al', sbTgt:'Target within ±5%',
    l1:{ eyebrow:'Schedule vs Forecasted Hours · Week of Sep 01 – Sep 07 · 007 - Encinitas', val:'+105.19h', valCls:'al',
      chip:'▲ Over-scheduled by 19.1%, about 3x the usual gap', chipCls:'al', tgt:'',
      stats:[{lbl:'Scheduled Hours',val:'656.34h',note:'98 shifts',cls:'al'},
             {lbl:'Forecasted Hours',val:'551.15h',note:'System forecast (fctStaff)',cls:'nm'},
             {lbl:'Variance %',val:'+19.1%',note:'Last 4 weeks: +6.6% to +7.2%',cls:'al'},
             {lbl:'Shifts Over 8 Hrs',val:'24',note:'27.74 OT hrs',cls:'al'}]},
    segs:[
      {key:'sat', lbl:'Saturday', pct:35, amt:'+36.97h', ov:'+34.2%', ovCls:'al', col:'#1A3A6B'},
      {key:'sun', lbl:'Sunday', pct:34, amt:'+36.05h', ov:'+33.2%', ovCls:'al', col:'#2E5FA3'},
      {key:'thu', lbl:'Thursday', pct:15, amt:'+15.58h', ov:'+21.2%', ovCls:'wn', col:'#5680BC'},
      {key:'other', lbl:'Mon–Wed & Fri', pct:16, amt:'+16.59h', ov:'+6.2%', ovCls:'nm', col:'#8AA8CC'},
    ],
    ai:'The schedule is <strong>105.19 hours over the system forecast (+19.1%)</strong>. The store\'s normal gap is about 7%, so this week jumped almost 3x. <strong>Saturday and Sunday hold 73 of the extra hours</strong> because weekend shifts are stretched to 9–10 hours. Thursday adds 15.6 more. Friday is the only day the forecast overstates what is needed; it is short at dinner (see Schedule Efficiency).',
    drivers:[
      { key:'sat', n:1, sev:'al', seg:'sat', icon:'calendar-clock', name:'Saturday 09/06 is scheduled 36.97 hours over forecast', sub:'145.01 scheduled vs 108.04 forecast. 12 of the 17 shifts run past 8 hours.', impact:'+36.97h', impCls:'al',
        insight:'<strong>Every Saturday shift is longer than the forecast calls for</strong>. The biggest gaps are the manager and shift-leader shifts, each more than 2.3 hours over.',
        subs:[{ name:'Longest Saturday Shifts vs Forecast', cols:['Employee','Role','Shift','Sch Hrs','Fcst Hrs','Over','OT Hrs','Sch $'],
          rows:[['Daniel Reyes','General Manager','7:00 AM – 5:25 PM','10.38h','7.55h',{v:'+2.83h',c:'tc-al'},'2.38h','$290.64'],
                ['Marcus Bell','Assistant Manager','2:30 PM – 12:10 AM','9.67h','7.16h',{v:'+2.51h',c:'tc-al'},'1.67h','$222.41'],
                ['Graciela Atempa','Assistant Manager','10:00 AM – 7:50 PM','9.82h','7.33h',{v:'+2.49h',c:'tc-al'},'1.82h','$225.86'],
                ['Tyler Brooks','Shift Leader','2:00 PM – 11:15 PM','9.23h','6.81h',{v:'+2.42h',c:'tc-al'},'1.23h','$179.99'],
                ['Kimberli Lopez','Shift Leader','6:30 AM – 4:10 PM','9.69h','7.31h',{v:'+2.38h',c:'tc-al'},'1.69h','$188.96'],
                ['Nicole Ramos','Line Cook','3:00 PM – 12:35 AM','9.58h','7.21h',{v:'+2.37h',c:'tc-al'},'1.58h','$162.86']]}],
        fixRecs:['Bring each Saturday shift back to 8 hours or less, starting with the manager and shift-leader shifts above.']},
      { key:'sun', n:2, sev:'al', seg:'sun', icon:'calendar-clock', name:'Sunday 09/07 is scheduled 36.05 hours over forecast', sub:'144.79 scheduled vs 108.74 forecast. Same pattern: 12 of 17 shifts past 8 hours.', impact:'+36.05h', impCls:'al',
        insight:'<strong>Sunday repeats Saturday\'s template.</strong> Three closing shifts also run past midnight (Omar Haddad to 12:45 AM, Hector Cruz to 12:40 AM, Noah Davis to 12:25 AM), even though the forecast winds down after 10 PM.',
        subs:[{ name:'Longest Sunday Shifts vs Forecast', cols:['Employee','Role','Shift','Sch Hrs','Fcst Hrs','Over','OT Hrs','Sch $'],
          rows:[['Olivia Martinez','GSA','3:15 PM – 12:10 AM','8.95h','6.46h',{v:'+2.49h',c:'tc-al'},'0.95h','$147.68'],
                ['Priya Nair','General Manager','7:15 AM – 4:55 PM','9.69h','7.28h',{v:'+2.41h',c:'tc-al'},'1.69h','$271.32'],
                ['Hannah Cho','Assistant Manager','10:15 AM – 7:55 PM','9.64h','7.32h',{v:'+2.32h',c:'tc-al'},'1.64h','$221.72'],
                ['Mei Tanaka','Shift Leader','6:45 AM – 4:35 PM','9.86h','7.54h',{v:'+2.32h',c:'tc-al'},'1.86h','$192.27'],
                ['Omar Haddad','Assistant Manager','2:45 PM – 12:45 AM','10.01h','7.77h',{v:'+2.24h',c:'tc-al'},'2.01h','$230.23'],
                ['Eliza Funes','Line Cook','10:45 AM – 8:15 PM','9.48h','7.25h',{v:'+2.23h',c:'tc-al'},'1.48h','$161.16']]}],
        fixRecs:['Cap every Sunday shift at 8 hours, then look at ending the past-midnight closers earlier.']},
      { key:'thu', n:3, sev:'wn', seg:'thu', icon:'trending-up', name:'Thursday 09/04 is scheduled 15.58 hours over forecast', sub:'All 14 shifts carry about 1 extra hour, and a 4th GSA was added for the afternoon.', impact:'+15.58h', impCls:'wn',
        insight:'<strong>All 14 Thursday shifts are flagged "Over forecast" in Deep Dive.</strong> The padding is spread evenly (0.8–1.5h per shift), so it looks like a template setting rather than one manager decision.',
        subs:[{ name:'Thursday Shifts vs Forecast', cols:['Employee','Role','Shift','Sch Hrs','Fcst Hrs','Over','Sch $'],
          rows:[['Daniel Reyes','General Manager','7:00 AM – 2:55 PM','7.89h','6.39h',{v:'+1.50h',c:'tc-wn'},'$220.92'],
                ['Hannah Cho','Assistant Manager','10:00 AM – 5:35 PM','7.59h','6.30h',{v:'+1.29h',c:'tc-wn'},'$174.57'],
                ['Cecilia Ramirez','GSA','10:00 AM – 4:25 PM','6.39h','5.17h',{v:'+1.22h',c:'tc-wn'},'$105.44'],
                ['Miguel Torres','Prep Cook','6:00 AM – 12:35 PM','6.59h','5.39h',{v:'+1.20h',c:'tc-wn'},'$105.44'],
                ['Andre Wilson','Line Cook','10:30 AM – 4:40 PM','6.18h','5.00h',{v:'+1.18h',c:'tc-wn'},'$105.06'],
                ['Mei Tanaka','Shift Leader','6:30 AM – 2:00 PM','7.52h','6.36h',{v:'+1.16h',c:'tc-wn'},'$146.64'],
                ['Rosa Delgado','Line Cook','8:00 AM – 1:50 PM','5.87h','4.74h',{v:'+1.13h',c:'tc-wn'},'$99.79'],
                ['Ava Thompson','GSA (extra)','4:00 PM – 10:55 PM','6.95h','5.84h',{v:'+1.11h',c:'tc-wn'},'$114.68'],
                ['Lily Nguyen','Prep Cook','9:00 AM – 3:15 PM','6.28h','5.20h',{v:'+1.08h',c:'tc-wn'},'$100.48'],
                ['Jordan Price','Shift Leader','2:00 PM – 8:10 PM','6.20h','5.18h',{v:'+1.02h',c:'tc-wn'},'$120.90'],
                ['Noah Davis','GSA','3:00 PM – 8:40 PM','5.67h','4.68h',{v:'+0.99h',c:'tc-nm'},'$93.56'],
                ['Jose Ramirez','Dishwasher','10:30 AM – 4:35 PM','6.07h','5.11h',{v:'+0.96h',c:'tc-nm'},'$94.09'],
                ['Carlos Mendoza','Line Cook','3:00 PM – 8:25 PM','5.39h','4.47h',{v:'+0.92h',c:'tc-nm'},'$91.63'],
                ['Olivia Martinez','GSA','11:00 AM – 3:30 PM','4.47h','3.65h',{v:'+0.82h',c:'tc-nm'},'$73.76']]}],
        fixRecs:['Reset the Thursday template to forecast length and drop the extra afternoon GSA.']},
      { key:'other', n:4, sev:'info', seg:'other', icon:'circle-check', name:'Mon–Wed and Friday are at the store\'s usual +6%', sub:'+16.59h across four days, in line with the last 4 weeks.', impact:'+16.59h', impCls:'nm',
        insight:'These four days add <strong>+3.25h to +4.72h each</strong>, which is the normal template gap. <strong>Friday\'s forecast is misleading:</strong> it was built from a Friday template that already runs short at dinner, so it shows Friday as over when it is actually short (see Schedule Efficiency).',
        subs:[{ name:'Weekday Scheduled vs Forecast', cols:['Date','Shifts','Sch Hrs','Fcst Hrs','Variance','Variance %'],
          rows:[['Mon 09/01','13','73.90h','69.99h',{v:'+3.91h',c:'tc-nm'},'+5.6%'],['Tue 09/02','13','72.56h','67.84h',{v:'+4.72h',c:'tc-nm'},'+7.0%'],['Wed 09/03','13','71.28h','66.57h',{v:'+4.71h',c:'tc-nm'},'+7.1%'],['Fri 09/05','11','59.74h','56.49h',{v:'+3.25h',c:'tc-nm'},'+5.8%']]}]},
    ],
    recs:['Cap Saturday and Sunday shifts at 8 hours. That removes 27.74h and is the single biggest fix.',
          'Trim the remaining ~45 weekend hours above forecast. That brings the week back near the store\'s usual +7%.',
          'Reset the Thursday template to forecast length and drop the extra afternoon GSA (−15.6h).',
          'Aim for a ±5% band next week. The store has sat at +6.6% to +7.2% for four straight weeks.']
  },
  /* 3 ---------------------------------------------------------------- */
  {
    id:'scheff', label:'Schedule Efficiency', sbVal:'89.0%', sbVar:'▼ −6.0 pts', sev:'wn', sbTgt:'Target 95.0%',
    l1:{ eyebrow:'Schedule Efficiency · Week of Sep 01 – Sep 07 · 007 - Encinitas', val:'89.0%', valCls:'wn',
      chip:'▼ 6.0 pts below target · 72.46h mismatched', chipCls:'wn', tgt:'',
      stats:[{lbl:'Over-scheduled',val:'52.71h',note:'Mon, Thu, Sat, Sun',cls:'al'},
             {lbl:'Under-scheduled',val:'19.75h',note:'Tue, Wed, Fri',cls:'wn'},
             {lbl:'Ideal Hours',val:'623.38h',note:'Fcst sales ÷ $89 SPLH',cls:'nm'},
             {lbl:'Scheduled Hours',val:'656.34h',note:'98 shifts',cls:'nm'}]},
    segs:[
      {key:'over', lbl:'Over-scheduling', pct:73, amt:'52.71h', ov:'4 days', ovCls:'al', col:'#1A3A6B'},
      {key:'under', lbl:'Under-scheduling', pct:27, amt:'19.75h', ov:'3 days', ovCls:'wn', col:'#E07A2F'},
    ],
    ai:'Schedule Efficiency is <strong>89.0%, 6 pts under the 95% target</strong>. 72.46 hours are in the wrong place: <strong>52.71h over-scheduled</strong> on Mon, Thu, Sat and Sun, and <strong>19.75h under-scheduled</strong> on Tue, Wed and Fri. The biggest problem is Friday: <strong>only 11 shifts, and no one on shift after 8:25 PM</strong>, even though Friday sales are the second-highest of any weekday.',
    drivers:[
      { key:'under', n:1, sev:'al', seg:'under', icon:'user-x', name:'Friday 09/05 is under-scheduled by 16.23 hours', sub:'11 shifts and 59.74 scheduled hours against about 76 ideal hours. From 5:00 PM only 2 people are on, and no one after 8:25 PM.', impact:'−16.23h short', impCls:'al',
        insight:'<strong>Friday needs about 76 hours for its sales but has 59.74.</strong> Most shifts end by 4:20 PM, so the evening is left with Chris Walker (to 8:10 PM) and Isabella Flores (to 8:25 PM). Luis Hernandez, Diego Ruiz and Maria Santos have approved time off on Fri 09/05 and their shifts were not re-filled. Because the forecast is built from this same Friday template, the system forecast doesn\'t catch it.',
        subs:[
          { name:'Friday 09/05 coverage by hour (after 2 PM)', cols:['Time Interval','Forecasted Staff','Scheduled Staff','Staff Variance','On Shift'],
            rows:[['2:00 PM – 3:00 PM','4.44','4.81',{v:'+0.37',c:'tc-nm'},'Omar, Chris, Jasmine, Liam, Mia, Brian'],
                  ['3:00 PM – 4:00 PM','4.12','4.14',{v:'+0.02',c:'tc-nm'},'Omar, Chris, Liam, Mia, Isabella, Brian'],
                  ['4:00 PM – 5:00 PM','3.26','2.70',{v:'−0.56',c:'tc-wn'},'Omar (to 4:20 PM), Chris, Mia, Isabella'],
                  ['5:00 PM – 6:00 PM','4.58','2.00',{v:'−2.58',c:'tc-al'},'Chris Walker, Isabella Flores'],
                  ['6:00 PM – 7:00 PM','3.93','2.00',{v:'−1.93',c:'tc-al'},'Chris Walker, Isabella Flores'],
                  ['7:00 PM – 8:00 PM','3.49','2.00',{v:'−1.49',c:'tc-al'},'Chris Walker, Isabella Flores'],
                  ['8:00 PM – 9:00 PM','1.73','0.56',{v:'−1.17',c:'tc-al'},'Isabella Flores to 8:25 PM, then no one'],
                  ['9:00 PM – close','0.15','0.00',{v:'−0.15',c:'tc-al'},'No one scheduled']]},
          { name:'Employees Free on Friday (no time off)', cols:['Employee','Position','Hrs This Week','Shifts','Time Off Fri 09/05','Suggested Friday Shift'],
            rows:[['Kevin Tran','Line Cook','5.37h','1',{v:'None',c:'tc-gd'},'3:00 PM – 9:00 PM'],['Carlos Mendoza','Line Cook','5.39h','1',{v:'None',c:'tc-gd'},'4:00 PM – 9:00 PM'],['Rosa Delgado','Line Cook','5.87h','1',{v:'None',c:'tc-gd'},'Backup'],['Jose Ramirez','Dishwasher','6.07h','1',{v:'None',c:'tc-gd'},'Backup'],
                  ['Luis Hernandez','Line Cook','13.82h','2',{v:'Approved',c:'tc-al'},'Not available'],['Diego Ruiz','Line Cook','11.92h','2',{v:'Approved',c:'tc-al'},'Not available'],['Maria Santos','Line Cook','6.62h','1',{v:'Approved',c:'tc-al'},'Not available']]}
        ],
        fixRecs:['Add two Friday evening shifts: Kevin Tran 3:00 PM – 9:00 PM and Carlos Mendoza 4:00 PM – 9:00 PM. That adds 11h, closes most of the gap, and keeps people on through close.',
                 'Fix the Friday template itself, and offer approved time-off shifts for pick-up instead of deleting them.']},
      { key:'over', n:2, sev:'al', seg:'over', icon:'users', name:'Mon, Thu, Sat and Sun are over-scheduled by 52.71 hours', sub:'Sunday +18.94h, Thursday +15.35h, Saturday +10.76h, Monday +7.66h against ideal hours.', impact:'+52.71h over', impCls:'al',
        insight:'<strong>Against what sales need, Sunday and Thursday are the most over-staffed days.</strong> Saturday looks less over here than against the forecast because it has the week\'s highest sales ($11,948), but its shifts are still too long. Monday has the lowest sales but the same template as Tuesday.',
        subs:[{ name:'Scheduled vs Ideal Hours by Day', cols:['Date','Shifts','Fcst Sales','Ideal Hrs','Sch Hrs','Gap','Sch SPLH','Efficiency'],
          rows:[['Mon 09/01','13','$5,895.42','66.24h','73.90h',{v:'+7.66h',c:'tc-wn'},'$79.78',{v:'89.6%',c:'tc-wn'}],
                ['Tue 09/02','13','$6,668.78','74.93h','72.56h',{v:'−2.37h',c:'tc-wn'},'$91.91',{v:'96.7%',c:'tc-gd'}],
                ['Wed 09/03','13','$6,446.69','72.43h','71.28h',{v:'−1.15h',c:'tc-nm'},'$90.44',{v:'98.4%',c:'tc-gd'}],
                ['Thu 09/04','14','$6,560.14','73.71h','89.06h',{v:'+15.35h',c:'tc-al'},'$73.66',{v:'82.8%',c:'tc-al'}],
                ['Fri 09/05','11','$6,760.94','75.97h','59.74h',{v:'−16.23h',c:'tc-al'},'$113.17',{v:'72.8%',c:'tc-al'}],
                ['Sat 09/06','17','$11,947.99','134.25h','145.01h',{v:'+10.76h',c:'tc-wn'},'$82.39',{v:'92.6%',c:'tc-wn'}],
                ['Sun 09/07','17','$11,200.86','125.85h','144.79h',{v:'+18.94h',c:'tc-al'},'$77.36',{v:'86.9%',c:'tc-wn'}]]}],
        fixRecs:['Cap weekend shifts at 8 hours (see Schedule Overtime), reset Thursday to forecast length, and remove Monday\'s padding.']},
      { key:'under', n:3, sev:'wn', seg:'under', icon:'arrow-left-right', name:'Tuesday and Wednesday are slightly short while Monday is over', sub:'Tue −2.37h and Wed −1.15h, while Monday is +7.66h. All three use the same 13-shift template.', impact:'−3.52h short', impCls:'wn',
        insight:'<strong>Tuesday sales are 13% higher than Monday\'s and Wednesday\'s are 9% higher, yet all three days get identical coverage.</strong> The fix is to move hours, not add them.',
        subs:[{ name:'Same Template, Different Demand', cols:['Date','Fcst Sales','Shifts','Sch Hrs','Ideal Hrs','Gap','Labor %'],
          rows:[['Mon 09/01','$5,895.42','13','73.90h','66.24h',{v:'+7.66h',c:'tc-wn'},'23.4%'],['Tue 09/02','$6,668.78','13','72.56h','74.93h',{v:'−2.37h',c:'tc-wn'},'20.3%'],['Wed 09/03','$6,446.69','13','71.28h','72.43h',{v:'−1.15h',c:'tc-nm'},'20.7%']]}],
        fixRecs:['Move about 3.5 hours from Monday to Tuesday and Wednesday lunch. Weekly hours stay the same and all three days reach 95%+.']},
    ],
    recs:['Add two Friday evening shifts (Kevin Tran 3:00 PM – 9:00 PM, Carlos Mendoza 4:00 PM – 9:00 PM) so the store is covered through close.',
          'Cap weekend shifts at 8 hours, starting with the longest manager shifts.',
          'Reset Thursday to forecast length and drop the extra GSA closer.',
          'Move about 3.5h from Monday into Tuesday/Wednesday lunch. Total hours don\'t change.']
  },
  /* 4 ---------------------------------------------------------------- */
  {
    id:'schot', label:'Schedule Overtime', sbVal:'27.74h', sbVar:'▲ +27.26h WoW', sev:'al', sbTgt:'Target 0h avoidable',
    l1:{ eyebrow:'Schedule Overtime · Week of Sep 01 – Sep 07 · 007 - Encinitas', val:'27.74h', valCls:'al',
      chip:'▲ $853.30 OT pay on 24 weekend shifts', chipCls:'al', tgt:'',
      stats:[{lbl:'OT Pay',val:'$853.30',note:'1.5x rate',cls:'al'},
             {lbl:'OT Shifts',val:'24',note:'12 Sat · 12 Sun',cls:'al'},
             {lbl:'Weekly OT (40h)',val:'0',note:'Highest: Priya Nair 29.45h',cls:'nm'},
             {lbl:'Last Week',val:'0.48h',note:'$19.33',cls:'nm'}]},
    segs:[
      {key:'sat', lbl:'Saturday 09/06', pct:53, amt:'14.47h · $448.13', ov:'12 shifts', ovCls:'al', col:'#1A3A6B'},
      {key:'sun', lbl:'Sunday 09/07', pct:47, amt:'13.27h · $405.17', ov:'12 shifts', ovCls:'al', col:'#2E5FA3'},
    ],
    ai:'<strong>27.74 OT hours ($853.30) are on the posted schedule. All of them are daily overtime</strong> (California, over 8h in a day) on Saturday and Sunday. None is weekly overtime: nobody is near 40 hours. Last week had 0.48h. <strong>All of it can be avoided.</strong> The weekend is already 73 hours over forecast, so capping each shift at 8 hours removes the overtime without adding anyone.',
    drivers:[
      { key:'sat', n:1, sev:'al', seg:'sat', icon:'alarm-clock', name:'12 Saturday shifts break the daily OT rule of 8 hours', sub:'14.47 OT hours · $448.13. The longest is Daniel Reyes at 10.38h.', impact:'+$448.13 OT', impCls:'al',
        insight:'<strong>Managers and shift leaders carry the most OT.</strong> Daniel Reyes, Graciela Atempa, Marcus Bell, Kimberli Lopez and Tyler Brooks make up 8.79 of the 14.47 hours, at the highest pay rates.',
        subs:[{ name:'Saturday 09/06 · Daily OT rule of 8 Hrs has breached', cols:['Employee','Role','Shift','Sch Hrs','OT Hrs','Pay Rate','OT $','Cut to 8h'],
          rows:[['Daniel Reyes','General Manager','7:00 AM – 5:25 PM','10.38h',{v:'2.38h',c:'tc-al'},'$28.00',{v:'$99.96',c:'tc-al'},'End 3:00 PM'],
                ['Graciela Atempa','Assistant Manager','10:00 AM – 7:50 PM','9.82h',{v:'1.82h',c:'tc-al'},'$23.00',{v:'$62.79',c:'tc-al'},'End 6:00 PM'],
                ['Marcus Bell','Assistant Manager','2:30 PM – 12:10 AM','9.67h',{v:'1.67h',c:'tc-al'},'$23.00',{v:'$57.62',c:'tc-al'},'Start 4:10 PM'],
                ['Kimberli Lopez','Shift Leader','6:30 AM – 4:10 PM','9.69h',{v:'1.69h',c:'tc-al'},'$19.50',{v:'$49.43',c:'tc-al'},'End 2:30 PM'],
                ['Nicole Ramos','Line Cook','3:00 PM – 12:35 AM','9.58h',{v:'1.58h',c:'tc-wn'},'$17.00',{v:'$40.29',c:'tc-wn'},'Start 4:35 PM'],
                ['Tyler Brooks','Shift Leader','2:00 PM – 11:15 PM','9.23h',{v:'1.23h',c:'tc-wn'},'$19.50',{v:'$35.98',c:'tc-wn'},'Start 3:15 PM'],
                ['Ethan Kim','Line Cook','8:00 AM – 5:15 PM','9.22h',{v:'1.22h',c:'tc-wn'},'$17.00',{v:'$31.11',c:'tc-wn'},'End 4:00 PM'],
                ['Pedro Alvarez','Line Cook','10:30 AM – 7:15 PM','8.72h',{v:'0.72h',c:'tc-wn'},'$17.00',{v:'$18.36',c:'tc-wn'},'End 6:30 PM'],
                ['Chloe Adams','GSA','11:00 AM – 7:40 PM','8.66h',{v:'0.66h',c:'tc-wn'},'$16.50',{v:'$16.34',c:'tc-wn'},'End 7:00 PM'],
                ['Mason Clark','GSA','3:00 PM – 11:35 PM','8.61h',{v:'0.61h',c:'tc-wn'},'$16.50',{v:'$15.10',c:'tc-wn'},'Start 3:35 PM'],
                ['Tomas Vega','Dishwasher','4:00 PM – 12:35 AM','8.58h',{v:'0.58h',c:'tc-wn'},'$15.50',{v:'$13.49',c:'tc-wn'},'Start 4:35 PM'],
                ['Lucas White','GSA','10:00 AM – 6:20 PM','8.31h',{v:'0.31h',c:'tc-nm'},'$16.50',{v:'$7.67',c:'tc-nm'},'End 6:00 PM']]}],
        fixRecs:['Cut each Saturday shift to 8 hours at the time shown. No cover is needed, because Saturday is still over forecast afterwards.']},
      { key:'sun', n:2, sev:'al', seg:'sun', icon:'alarm-clock', name:'12 Sunday shifts break the daily OT rule of 8 hours', sub:'13.27 OT hours · $405.17. Omar Haddad\'s 10.01h close is the longest.', impact:'+$405.17 OT', impCls:'al',
        insight:'<strong>Sunday\'s three latest closers finish between 12:10 and 12:45 AM</strong>, well after the forecast drops off. Capping them at 8 hours removes their OT, and the forecast suggests they could end even earlier.',
        subs:[{ name:'Sunday 09/07 · Daily OT rule of 8 Hrs has breached', cols:['Employee','Role','Shift','Sch Hrs','OT Hrs','Pay Rate','OT $','Cut to 8h'],
          rows:[['Omar Haddad','Assistant Manager','2:45 PM – 12:45 AM','10.01h',{v:'2.01h',c:'tc-al'},'$23.00',{v:'$69.35',c:'tc-al'},'End 10:45 PM'],
                ['Priya Nair','General Manager','7:15 AM – 4:55 PM','9.69h',{v:'1.69h',c:'tc-al'},'$28.00',{v:'$70.98',c:'tc-al'},'End 3:15 PM'],
                ['Mei Tanaka','Shift Leader','6:45 AM – 4:35 PM','9.86h',{v:'1.86h',c:'tc-al'},'$19.50',{v:'$54.41',c:'tc-al'},'End 2:45 PM'],
                ['Hannah Cho','Assistant Manager','10:15 AM – 7:55 PM','9.64h',{v:'1.64h',c:'tc-al'},'$23.00',{v:'$56.58',c:'tc-al'},'End 6:15 PM'],
                ['Eliza Funes','Line Cook','10:45 AM – 8:15 PM','9.48h',{v:'1.48h',c:'tc-wn'},'$17.00',{v:'$37.74',c:'tc-wn'},'End 6:45 PM'],
                ['Cecilia Ramirez','GSA','11:15 AM – 8:20 PM','9.09h',{v:'1.09h',c:'tc-wn'},'$16.50',{v:'$26.98',c:'tc-wn'},'End 7:15 PM'],
                ['Austin Gray','GSA','10:15 AM – 7:15 PM','8.96h',{v:'0.96h',c:'tc-wn'},'$16.50',{v:'$23.76',c:'tc-wn'},'End 6:15 PM'],
                ['Olivia Martinez','GSA','3:15 PM – 12:10 AM','8.95h',{v:'0.95h',c:'tc-wn'},'$16.50',{v:'$23.51',c:'tc-wn'},'End 11:15 PM'],
                ['Jordan Price','Shift Leader','2:15 PM – 10:55 PM','8.66h',{v:'0.66h',c:'tc-wn'},'$19.50',{v:'$19.31',c:'tc-wn'},'End 10:15 PM'],
                ['Hector Cruz','Dishwasher','4:15 PM – 12:40 AM','8.45h',{v:'0.45h',c:'tc-nm'},'$15.50',{v:'$10.46',c:'tc-nm'},'End 12:15 AM'],
                ['Luis Hernandez','Line Cook','3:15 PM – 11:35 PM','8.30h',{v:'0.30h',c:'tc-nm'},'$17.00',{v:'$7.65',c:'tc-nm'},'End 11:15 PM'],
                ['Noah Davis','GSA (minor)','4:15 PM – 12:25 AM','8.18h',{v:'0.18h',c:'tc-nm'},'$16.50',{v:'$4.46',c:'tc-nm'},'End 10:00 PM (minor rule)']]}],
        fixRecs:['Cut each Sunday shift to 8 hours. End Noah Davis by 10:00 PM, because he is a minor with school on Monday.']},
      { key:'role', n:3, sev:'wn', icon:'badge-dollar-sign', name:'Managers hold 49% of the OT dollars', sub:'GM and AM OT is 11.21h but $417.27, because 1.5x on a $23–$28 rate costs the most.', impact:'$417.27 of $853.30', impCls:'wn',
        insight:'<strong>Per OT hour, a GM costs $42.00 and an AM $34.50, against $23.25–$29.25 for crew.</strong> Trimming the four GM/AM weekend shifts first saves the most per hour cut.',
        subs:[{ name:'Scheduled OT by Role', cols:['Role','OT Shifts','OT Hrs','OT $','OT $/hr','Share of OT $'],
          rows:[['General Manager','2','4.07h',{v:'$170.94',c:'tc-al'},'$42.00','20.0%'],['Assistant Manager','4','7.14h',{v:'$246.33',c:'tc-al'},'$34.50','28.9%'],['Shift Leader','4','5.44h',{v:'$159.12',c:'tc-wn'},'$29.25','18.6%'],['Line Cook','5','5.30h',{v:'$135.15',c:'tc-wn'},'$25.50','15.8%'],['GSA','7','4.76h',{v:'$117.81',c:'tc-wn'},'$24.75','13.8%'],['Dishwasher','2','1.03h',{v:'$23.95',c:'tc-nm'},'$23.25','2.8%'],['Prep Cook','0','0.00h',{v:'$0.00',c:'tc-gd'},'—','0.0%']]}]},
      { key:'wk', n:4, sev:'info', icon:'shield-check', name:'No one is at risk of weekly overtime', sub:'Weekly OT rule of 40 Hrs is not breached: the highest week is Priya Nair at 29.45h.', impact:'0h weekly OT', impCls:'nm',
        insight:'Every OT hour this week comes from <strong>shift length</strong>, not total hours, so no one needs to be moved to another day. Staff with open hours are listed below if you want to split a long shift instead of cutting it.',
        subs:[{ name:'Staff With Open Hours This Week', cols:['Employee','Role','Hrs This Week','Shifts','Room to 40 Hrs'],
          rows:[['Chris Walker','Shift Leader','11.58h','2','28.42h'],['Ana Morales','Shift Leader','12.17h','2','27.83h'],['Kevin Tran','Line Cook','5.37h','1','34.63h'],['Carlos Mendoza','Line Cook','5.39h','1','34.61h'],['Liam Rodriguez','GSA','10.30h','2','29.70h'],['Isabella Flores','GSA','10.35h','2','29.65h'],['Brian Scott','Dishwasher','4.30h','1','35.70h']]}]},
    ],
    recs:['Cap all 24 weekend shifts at 8 hours using the "Cut to 8h" times above. Removes $853.30 of OT.',
          'Start with the 6 GM/AM shifts. They are $417.27 of the OT at $34.50–$42.00 per OT hour.',
          'Then look at closing Sunday earlier. The forecast drops off after 10 PM, but 3 closers stay past midnight.',
          'Set an alert when any shift is built past 8 hours, so the template can\'t drift back.']
  },
  /* 5 ---------------------------------------------------------------- */
  {
    id:'schcomp', label:'Schedule Compliance', sbVal:'65.3%', sbVar:'▼ 37 warnings', sev:'al', sbTgt:'Target 95.0%',
    l1:{ eyebrow:'Schedule Compliance · Week of Sep 01 – Sep 07 · 007 - Encinitas', val:'65.3%', valCls:'al',
      chip:'▼ 34 of 98 shifts carry a schedule warning', chipCls:'al', tgt:'',
      stats:[{lbl:'Schedule Warnings',val:'37',note:'On 34 shifts',cls:'al'},
             {lbl:'Legal Risk',val:'4',note:'2 minor · 2 meal break',cls:'al'},
             {lbl:'Changed After Publish',val:'8',note:'Shifts edited after publish',cls:'wn'},
             {lbl:'Shifts With Warnings',val:'34 of 98',note:'64 warning-free',cls:'al'}]},
    segs:[
      {key:'dot', lbl:'Daily OT (8 hrs)', pct:65, amt:'24', ov:'Sat · Sun', ovCls:'al', col:'#1A3A6B'},
      {key:'edit', lbl:'Changed after publish', pct:22, amt:'8', ov:'Tue · Wed · Fri', ovCls:'wn', col:'#2E5FA3'},
      {key:'minor', lbl:'Minor rules', pct:5, amt:'2', ov:'Fri · Sun', ovCls:'al', col:'#C2410C'},
      {key:'meal', lbl:'Meal break', pct:5, amt:'2', ov:'Sat · Sun', ovCls:'al', col:'#5680BC'},
      {key:'avail', lbl:'Availability', pct:3, amt:'1', ov:'Thu', ovCls:'wn', col:'#8AA8CC'},
    ],
    ai:'<strong>37 schedule warnings sit on 34 of the 98 shifts</strong>, so only 65.3% of the schedule is warning-free. Most are <strong>daily overtime on Sat and Sun (24)</strong>. The ones to fix first are the <strong>4 legal risks</strong>: two minors scheduled past their limits (Mia Lee on Friday, Noah Davis on Sunday) and two 10-hour shifts without a second meal break. Every warning below shows its day and the fix. Monday has none.',
    drivers:[
      { key:'minor', n:1, sev:'al', seg:'minor', icon:'shield-alert', name:'2 minors are scheduled outside the minor-labor rules', sub:'Mia Lee (16) works 5.08h on a school day, and Noah Davis (17) closes at 12:25 AM before a school day.', impact:'Legal risk', impCls:'al',
        insight:'<strong>These are the most serious warnings on the schedule.</strong> A minor violation can only be fixed by changing the shift itself before it is worked. A 16-year-old is limited to 4 hours on a school day, and minors cannot work after 10:00 PM before a school day.',
        subs:[{ name:'Minor-Rule Warnings', cols:['Date','Employee','Age','Shift','Sch Hrs','Warning','How to fix'],
          rows:[['Fri 09/05','Mia Lee','16','11:15 AM – 4:20 PM','5.08h',{v:'Maximum Hrs Per Day rule of 4 Hrs has breached.',c:'tc-al'},'End at 3:15 PM. Isabella Flores (3:15 PM start) covers.'],
                ['Sun 09/07','Noah Davis','17','4:15 PM – 12:25 AM','8.18h',{v:'Minor Employee cannot be scheduled after 10:00 PM.',c:'tc-al'},'End at 10:00 PM. Olivia Martinez and Hector Cruz close.']]}],
        fixRecs:['Change both shifts today. Mia Lee ends at 3:15 PM on Friday, and Noah Davis ends at 10:00 PM on Sunday.']},
      { key:'meal', n:2, sev:'al', seg:'meal', icon:'coffee', name:'2 shifts over 10 hours have no second meal break', sub:'Daniel Reyes (Sat, 10.38h) and Omar Haddad (Sun, 10.01h) are scheduled past 10 hours with only one meal break.', impact:'2 warnings', impCls:'al',
        insight:'<strong>A second 30-minute meal break is required once a shift passes 10 hours.</strong> Both shifts also carry daily OT. Cutting them to 8 hours clears both warnings at once.',
        subs:[{ name:'Meal-Break Warnings', cols:['Date','Employee','Role','Shift','Sch Hrs','Warning','How to fix'],
          rows:[['Sat 09/06','Daniel Reyes','General Manager','7:00 AM – 5:25 PM','10.38h',{v:'Meal Break rule breached. A break to be provided in a shift more than 10 Hrs.',c:'tc-al'},'End at 3:00 PM (8h), or add a 2nd meal before 5:00 PM'],
                ['Sun 09/07','Omar Haddad','Assistant Manager','2:45 PM – 12:45 AM','10.01h',{v:'Meal Break rule breached. A break to be provided in a shift more than 10 Hrs.',c:'tc-al'},'End at 10:45 PM (8h), or add a 2nd meal before 12:45 AM']]}],
        fixRecs:['Cut both shifts to 8 hours. That removes the meal-break and daily OT warnings together.']},
      { key:'dot', n:3, sev:'al', seg:'dot', icon:'alarm-clock', name:'24 weekend shifts break the daily OT rule of 8 hours', sub:'12 on Saturday and 12 on Sunday. These are the same shifts listed in Schedule Overtime.', impact:'24 warnings · $853.30', impCls:'al',
        insight:'<strong>This is one template problem, not 24 separate ones.</strong> Weekend shifts are built 9–10 hours long. Capping them at 8 hours clears 24 of the 37 warnings and lifts compliance from 65.3% to about 89%.',
        subs:[{ name:'Daily OT Warnings by Day', cols:['Date','Warning','Shifts','OT Hrs','OT $','How to fix'],
          rows:[['Sat 09/06',{v:'Daily OT rule of 8 Hrs has breached.',c:'tc-al'},'12','14.47h','$448.13','Cut each shift to 8h (times in Schedule Overtime)'],
                ['Sun 09/07',{v:'Daily OT rule of 8 Hrs has breached.',c:'tc-al'},'12','13.27h','$405.17','Cut each shift to 8h (times in Schedule Overtime)']]}],
        fixRecs:['Cap every Sat/Sun shift at 8 hours. See Schedule Overtime for the exact cut time on each shift.']},
      { key:'edit', n:4, sev:'wn', seg:'edit', icon:'file-pen', name:'8 shifts were changed after the schedule was published', sub:'Tuesday, Wednesday and Friday. Shift compliance on these shifts is 82.7–88.0%, against a 95% minimum.', impact:'8 warnings', impCls:'wn',
        insight:'<strong>All 8 are opening and mid-day shifts on the same three days</strong>, and Priya Nair\'s shift was edited on both Wednesday and Friday. Each change sends the employee a "Your schedule for week of 09/01 has been updated." email, so staff see a different schedule from the one they planned around.',
        subs:[{ name:'Shifts Changed After Publish', cols:['Date','Employee','Role','Shift','Sch Hrs','Compliance','Status','How to fix'],
          rows:[['Tue 09/02','Daniel Reyes','General Manager','7:00 AM – 1:35 PM','6.57h',{v:'83.7%',c:'tc-al'},'Shift Updated and Published.','Make the change in the draft before publishing'],
                ['Tue 09/02','Luis Hernandez','Line Cook','3:00 PM – 8:30 PM','5.52h',{v:'84.2%',c:'tc-al'},'Shift Updated and Published.','Make the change in the draft before publishing'],
                ['Tue 09/02','Aaliyah Brown','Dishwasher','10:30 AM – 3:35 PM','5.05h',{v:'86.2%',c:'tc-wn'},'Shift Updated and Published.','Make the change in the draft before publishing'],
                ['Wed 09/03','Priya Nair','General Manager','7:15 AM – 1:45 PM','6.54h',{v:'82.7%',c:'tc-al'},'Shift Updated and Published.','Make the change in the draft before publishing'],
                ['Wed 09/03','Kevin Tran','Line Cook','3:15 PM – 8:35 PM','5.37h',{v:'84.8%',c:'tc-al'},'Shift Updated and Published.','Make the change in the draft before publishing'],
                ['Wed 09/03','Hector Cruz','Dishwasher','10:45 AM – 3:00 PM','4.23h',{v:'85.7%',c:'tc-wn'},'Shift Updated and Published.','Make the change in the draft before publishing'],
                ['Fri 09/05','Priya Nair','General Manager','7:15 AM – 2:00 PM','6.71h',{v:'88.0%',c:'tc-wn'},'Shift Updated and Published.','Make the change in the draft before publishing'],
                ['Fri 09/05','Grace Park','Prep Cook','9:15 AM – 1:50 PM','4.57h',{v:'84.6%',c:'tc-al'},'Shift Updated and Published.','Make the change in the draft before publishing']]}],
        fixRecs:['Make changes before publishing, not after. Review Tue, Wed and Fri start times in the draft so the published schedule stays as posted.']},
      { key:'avail', n:5, sev:'wn', seg:'avail', icon:'calendar-x', name:'Ava Thompson is scheduled past her availability on Thursday', sub:'Her shift is 4:00 – 10:55 PM, but she is only available until 9:00 PM. This is also the extra Thursday GSA.', impact:'1 warning', impCls:'wn',
        insight:'<strong>The extra Thursday closer was added outside Ava\'s availability.</strong> Ending it at 9:00 PM clears the warning and removes 1.92h of Thursday\'s over-scheduling.',
        subs:[{ name:'Availability Warning', cols:['Date','Employee','Role','Shift','Available Until','Hrs Past Availability','Warning','How to fix'],
          rows:[['Thu 09/04','Ava Thompson','GSA','4:00 PM – 10:55 PM','9:00 PM','1.92h',{v:'Employee is not available. Employee is available between 4:00 PM and 9:00 PM.',c:'tc-wn'},'End at 9:00 PM, or remove the extra closer']]}],
        fixRecs:['End Ava Thompson\'s Thursday shift at 9:00 PM, or remove the extra closer entirely.']},
    ],
    checks:[{lbl:'Weekly OT rule of 40 Hrs',v:'0 · max 29.45h',ok:true},{lbl:'Daily DT rule of 12 Hrs',v:'0 · longest 10.38h',ok:true},{lbl:'Minimum Time Off Between Shifts (5 Hrs)',v:'0 clopenings',ok:true},{lbl:'7th Consecutive Day',v:'0 · max 4 days',ok:true},{lbl:'Employee does not belong to Position',v:'0',ok:true},{lbl:'Minor rules',v:'2 breached',ok:false},{lbl:'Meal break (10+ hrs)',v:'2 breached',ok:false},{lbl:'Daily OT rule of 8 Hrs',v:'24 breached',ok:false}],
    recs:['Fix the 2 minor shifts today: Mia Lee ends at 3:15 PM on Friday, and Noah Davis ends at 10:00 PM on Sunday.',
          'Cap every weekend shift at 8 hours. That clears 24 OT warnings and both meal-break warnings, and lifts compliance to about 89%.',
          'End Ava Thompson\'s Thursday shift at 9:00 PM to match her availability.',
          'Stop editing shifts after publishing. Make changes in the draft before the schedule goes out (8 this week).']
  },
];

const AHUB_IMPACT_DATA = {
  schlabor: {
    charts: [
      { title:'Schedule Labor % · 6 weeks', values:[20.23,20.93,21.2,20.83,20.79,22.01], lastVal:'22.0%', cls:'al', col:'#ef4444' },
      { title:'Labor % by day (this week)', values:[23.36,20.32,20.65,25.11,16.74,22.52,23.90], lastVal:'Sun 23.9%', cls:'wn', col:'#f59e0b' },
    ],
    vs: [
      { lbl:'Schedule Labor %', val:'22.0%', chg:'▲ 3.5 pts', cls:'al' },
      { lbl:'Labor $ over forecast', val:'$1,950.14', chg:'▲ $1,950', cls:'al' },
      { lbl:'Weekend share of excess', val:'$1,352.81', chg:'69%', cls:'al' },
    ]
  },
  schvsfcst: {
    charts:[
      { title:'Sch − Fcst hours · 6 weeks', values:[35.87,39.51,38.68,37.07,35.71,105.19], lastVal:'+105.19h', cls:'al', col:'#ef4444' },
      { title:'Sch − Fcst hours by day', values:[3.91,4.72,4.71,15.58,3.25,36.97,36.05], lastVal:'Sun +36.05h', cls:'al', col:'#ef4444' },
    ],
    vs:[
      { lbl:'Scheduled Hours', val:'656.34h', chg:'▲ 105.19h', cls:'al' },
      { lbl:'Weekend Variance', val:'+73.02h', chg:'▲ 33.7%', cls:'al' },
      { lbl:'Thursday Variance', val:'+15.58h', chg:'▲ 21.2%', cls:'wn' },
    ]
  },
  scheff: {
    charts:[
      { title:'Schedule Efficiency · 6 weeks', values:[89.9,89.63,88.29,85.72,87.77,88.96], lastVal:'89.0%', cls:'wn', col:'#f59e0b' },
      { title:'Over − under hrs by day', values:[7.66,-2.37,-1.15,15.35,-16.23,10.76,18.94], lastVal:'Fri −16.23h', cls:'al', col:'#ef4444' },
    ],
    vs:[
      { lbl:'Schedule Efficiency', val:'89.0%', chg:'▼ 6.0 pts', cls:'wn' },
      { lbl:'Over-scheduled', val:'52.71h', chg:'▲ 52.71h', cls:'al' },
      { lbl:'Under-scheduled', val:'19.75h', chg:'▼ 19.75h', cls:'wn' },
    ]
  },
  schot: {
    charts:[
      { title:'Scheduled OT hours · 6 weeks', values:[0.28,0.19,0.12,0.52,0.48,27.74], lastVal:'27.74h', cls:'al', col:'#ef4444' },
      { title:'OT $ by day (this week)', values:[0,0,0,0,0,448.13,405.17], lastVal:'$853.30', cls:'al', col:'#ef4444' },
    ],
    vs:[
      { lbl:'OT Hours', val:'27.74h', chg:'▲ 27.26h', cls:'al' },
      { lbl:'OT Pay', val:'$853.30', chg:'▲ $833.97', cls:'al' },
      { lbl:'Weekly OT (40h)', val:'0', chg:'On target', cls:'gd' },
    ]
  },
  schcomp: {
    charts:[
      { title:'Schedule Compliance · 6 weeks', values:[99.0,98.0,98.0,96.9,97.9,65.3], lastVal:'65.3%', cls:'al', col:'#ef4444' },
      { title:'Warnings by day (this week)', values:[0,3,3,1,3,13,14], lastVal:'37', cls:'al', col:'#ef4444' },
    ],
    vs:[
      { lbl:'Warning-free shifts', val:'64 of 98', chg:'▼ 29.7 pts', cls:'al' },
      { lbl:'Legal-risk warnings', val:'4', chg:'Fix first', cls:'al' },
      { lbl:'Changed after publish', val:'8', chg:'▲ 8', cls:'wn' },
    ]
  },
};

if (typeof window !== 'undefined') {
  window.AHUB_KPI_DATA = AHUB_KPI_DATA;
  window.AHUB_IMPACT_DATA = AHUB_IMPACT_DATA;
}
