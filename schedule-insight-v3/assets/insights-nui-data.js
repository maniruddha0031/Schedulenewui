/* ============================================================
   Schedule Insight — Insights tab data
   Shape: {id, group, badge, badgeText, short, title, meta, impact, tags[],
   chips[], rootPoints[], tableLabel, tableSub, tableHeaders[], tableRows[],
   tableRowTone[], recommendation, actions[]}.

   Every insight is built from data elements the Zip Schedule app has
   (HW Release / hubworks): shifts + shift times, scheduled vs forecasted
   hours (fctStaff), forecasted staff vs scheduled staff per interval
   (staffVariance), labor budget (Budget $ / Budget Hrs / Sch Labor %),
   time-off requests (Approved / Pending) and schedule warnings with the
   product's own messages (Daily OT, Meal Break, Minor, Availability,
   Time Off overlap). All figures reconcile with the Deep Dive data
   (deepdive-data.js): Store 007 - Encinitas, week of Sep 01 – Sep 07, 2026.

   Model used for the staffing figures:
     - Labor budget       20.0% of forecasted sales (weekly + daily budget)
                          Budget Hrs = Budget $ ÷ avg pay rate $18.60
     - Forecasted staff   fctStaff spread over the day on the store's
                          normal demand curve; Staff Variance = scheduled −
                          forecasted staff per hour (Forecast report)
   badge: 'sev-good' | 'sev-warn' | 'sev-alert' | 'sev-info'
   ============================================================ */

const SI_INS_ALL = [
  /* DAILY insights are generated per selected date: see insights-daily.js */
  /* ================= WEEKLY ================= */
  {
    id:100, group:'weekly', badge:'sev-alert', badgeText:'Alert', short:'Weekly Labor Budget',
    title:'This week is 59.90 hrs over the labor budget: 22.01% scheduled vs a 20.00% budget',
    meta:'Week of Sep 01 · Budget 596.44 hrs | 20.00% · Scheduled 656.34 hrs | 22.01% · 6 of 7 days over budget',
    impact:'−59.90 hrs · Over', tags:['−2.01% variance','6 of 7 days over'],
    chips:[{l:'Labor Budget %',v:'20.00%',c:''},{l:'Budget Hrs',v:'596.44 hrs',c:''},{l:'Scheduled Labor %',v:'22.01%',c:'neg'},{l:'Scheduled Hrs',v:'656.34 hrs',c:''},
           {l:'Variance Hrs',v:'−59.90 hrs',c:'neg'},{l:'Variance %',v:'−2.01%',c:'neg'},{l:'Days Over Budget',v:'6 of 7',c:'neg'},{l:'Forecast Hrs',v:'551.15 hrs',c:''}],
    rootPoints:[
      'Budget for the week is <b>596.44 hrs | 20.00%</b>; scheduled <b>656.34 hrs | 22.01%</b> → Variance <b>−59.90 hrs | −2.01%</b>',
      'Biggest gaps: <b>Sun −24.38 hrs | −3.90%</b>, <b>Thu −18.54 hrs | −5.11%</b>, <b>Sat −16.56 hrs | −2.52%</b>, Mon −10.52 hrs | −3.36%',
      '<b>24 weekend shifts run past 8 hrs</b>, adding 27.74 hrs: 46% of the hours over budget',
      '<b>Friday is +12.94 hrs | +3.26% under</b> only because it is understaffed from 4:00 PM to close, so it is not a saving to keep',
    ],
    tableLabel:'Budget (By Configured Forecast Percentage)', tableSub:'Hrs | % as shown on the schedule pad · Variance = Budget − Scheduled · negative = over budget',
    tableHeaders:['Day','Budget (Hrs | %)','Scheduled (Hrs | %)','Variance (Hrs | %)','Status'],
    tableRowIcon:['calendar','calendar','calendar','alert','calendar','alert','alert'],
    tableRows:[
      ['Mon 09/01','63.38 | 20.00%','73.90 | 23.36%','−10.52 | −3.36%','Over budget'],
      ['Tue 09/02','71.69 | 20.00%','72.56 | 20.32%','−0.87 | −0.32%','Over budget'],
      ['Wed 09/03','69.30 | 20.00%','71.28 | 20.65%','−1.98 | −0.65%','Over budget'],
      ['Thu 09/04','70.52 | 20.00%','89.06 | 25.11%','−18.54 | −5.11%','Over budget'],
      ['Fri 09/05','72.68 | 20.00%','59.74 | 16.74%','+12.94 | +3.26%','Under budget · understaffed'],
      ['Sat 09/06','128.45 | 20.00%','145.01 | 22.52%','−16.56 | −2.52%','Over budget'],
      ['Sun 09/07','120.41 | 20.00%','144.79 | 23.90%','−24.38 | −3.90%','Over budget'],
      ['Week','596.44 | 20.00%','656.34 | 22.01%','−59.90 | −2.01%','Over budget'],
    ],
    tableRowTone:['warn','ok','ok','bad','good','bad','bad','bad'],
    noTotal:true,
    recommendation:'3 actions for the manager on next week\'s schedule, before it is published.',
    actions:[
      {title:'Manager · weekend template', body:'Cap Sat/Sun shifts at 8 hrs. Removes 27.74 hrs and takes the week from −59.90 to −32.16 hrs vs budget.'},
      {title:'Manager · Thursday + Monday', body:'Drop the extra Thursday closing shift (4:00 – 10:55 PM, 6.95 hrs) and trim Monday to its 63.38 budget hrs (about 10.5 hrs). The week then ends about −14.7 hrs vs budget.'},
      {title:'Manager · Friday', body:'Use the 12.94 budget hrs Friday has left on 2 extra shifts for 3:00 PM – close (about 11 hrs). Friday stays within its budget.'},
    ],
  },
  {
    id:101, group:'weekly', badge:'sev-alert', badgeText:'Alert', short:'Over & Understaffing',
    title:'114.54 overstaffed hours and 9.35 understaffed hours this week: right total, wrong place',
    meta:'Week of Sep 01 · forecasted vs scheduled staff per hour · Schedule Efficiency 81.1%',
    impact:'114.54 hrs over · 9.35 short', tags:['Sat/Sun +73.02 hrs','Fri 4 PM–close −7.89 hrs'],
    chips:[{l:'Overstaffed Hrs',v:'114.54 hrs',c:'neg'},{l:'Understaffed Hrs',v:'9.35 hrs',c:'neg'},{l:'Net vs Forecast',v:'+105.19 hrs',c:''},{l:'Schedule Efficiency',v:'81.1%',c:'neg'}],
    rootPoints:[
      '<b>Saturday (+36.97) and Sunday (+36.05)</b> are overstaffed in almost every hour of the day: shifts are built 9–10 hrs long',
      '<b>Thursday +15.58 hrs</b>: 14 shifts instead of 13, and each runs longer',
      '<b>Friday is short 7.89 hrs</b>, all from 4:00 PM to close, after 3 employees\' approved time off wasn\'t replaced',
      'Mon–Wed are within <b>4–6 hrs</b> of forecast: the template works on normal days',
    ],
    tableLabel:'Over- and understaffing by day', tableSub:'Staff-hours above / below forecasted staff, summed per hour',
    tableHeaders:['Day','Fcst Hrs','Sch Hrs','Overstaffed Hrs','Understaffed Hrs','Biggest Window'],
    tableRowIcon:['calendar','calendar','calendar','alert','alert','alert','alert'],
    tableRows:[
      ['Mon 09/01','69.99 hrs','73.90 hrs','4.18 hrs','0.27 hrs','Over 7:00 AM – 4:00 PM (+3.34)'],
      ['Tue 09/02','67.84 hrs','72.56 hrs','5.64 hrs','0.92 hrs','Over 6:00 AM – 8:00 PM (+5.64)'],
      ['Wed 09/03','66.57 hrs','71.28 hrs','4.98 hrs','0.27 hrs','Over 7:00 AM – 9:00 PM (+4.98)'],
      ['Thu 09/04','73.48 hrs','89.06 hrs','15.58 hrs','0.00 hrs','Over 1:00 PM – 6:00 PM (+7.37)'],
      ['Fri 09/05','56.49 hrs','59.74 hrs','11.14 hrs','7.89 hrs','Short 4:00 PM – close (−7.89)'],
      ['Sat 09/06','108.04 hrs','145.01 hrs','36.97 hrs','0.00 hrs','Over 8:00 AM – 11:00 PM (+34.58)'],
      ['Sun 09/07','108.74 hrs','144.79 hrs','36.05 hrs','0.00 hrs','Over 9:00 AM – 12:00 AM (+33.75)'],
    ],
    tableRowTone:['ok','ok','ok','bad','bad','bad','bad'],
    recommendation:'3 actions for the manager on next week\'s schedule.',
    actions:[
      {title:'Manager · weekend', body:'Cap shifts at 8 hrs and end the 3 past-midnight closers by 11:00 PM. Removes about 29 of the 73 weekend overstaffed hrs.'},
      {title:'Manager · Friday', body:'Add 2 shifts (3:00 – 9:00 PM and 4:00 – 9:00 PM) and keep one person scheduled to close.'},
      {title:'Manager · Thursday', body:'Remove the extra closing shift (4:00 – 10:55 PM) and the ~40 min padding per shift.'},
    ],
  },
  {
    id:102, group:'weekly', badge:'sev-alert', badgeText:'Alert', short:'Schedule Compliance',
    title:'39 schedule warnings on 36 of 98 shifts. 4 are legal risks that must be fixed first',
    meta:'Week of Sep 01 · warning-free shifts 63.3% · Mon is the only clean day',
    impact:'39 violations', tags:['4 legal risks','Sat 15 · Sun 14'],
    chips:[{l:'Daily OT (8 Hrs)',v:'24',c:'neg'},{l:'Unpublished',v:'8',c:'neg'},{l:'Minor',v:'2',c:'neg'},{l:'Meal Break',v:'2',c:'neg'},
           {l:'Time-Off Overlap',v:'2',c:'neg'},{l:'Availability',v:'1',c:'neg'},{l:'Weekly OT (40 Hrs)',v:'0',c:'pos'},{l:'Daily DT (12 Hrs)',v:'0',c:'pos'}],
    rootPoints:[
      '<b>24 Daily OT</b> warnings are one template problem: weekend shifts built 9–10 hrs long',
      '<b>Legal risks:</b> 2 minors past their limits (Mia Lee Fri, Noah Davis Sun) and 2 shifts over 10 hrs with no 2nd meal break',
      '<b>8 shifts are still unpublished</b> after edits (Tue, Wed, Fri) and 2 Saturday shifts overlap time off',
      'No weekly OT, no clopenings and no 7th consecutive day this week',
    ],
    tableLabel:'Violations by type', tableSub:'Week of Sep 01 · warning text as shown on the schedule pad',
    tableHeaders:['Violation Type','Rule','Count','Days','Exposure'],
    tableRowIcon:['alert','alert','alert','alert','alert','alert'],
    tableRows:[
      ['Minor','Minor Employee cannot be scheduled after 10:00 PM. / Maximum Hrs Per Day rule of 4 Hrs has breached.','2','Fri, Sun','Legal risk'],
      ['Meal Break','Meal Break rule breached. A break to be provided in a shift more than 10 Hrs.','2','Sat, Sun','2nd meal break needed'],
      ['Time-Off Overlap','Shift overlapping with Timeoff. / Overlapping Approved/Pending Time Off exists.','2','Sat','2 shifts to remove'],
      ['Availability','Employee is not available. Employee is available between 4:00 PM and 9:00 PM.','1','Thu','1.92 hrs past availability'],
      ['Daily OT','Daily OT rule of 8 Hrs has breached.','24','Sat, Sun','$853.30 OT'],
      ['Unpublished','Unpublished shift: the employee has not received this shift.','8','Tue, Wed, Fri','7 employees without shift details'],
    ],
    tableRowTone:['bad','bad','warn','warn','warn','ok'],
    recommendation:'3 actions for the manager, in order of risk.',
    actions:[
      {title:'Manager · today', body:'Fix the 4 legal risks: Mia Lee ends 3:15 PM Fri, Noah Davis ends 10:00 PM Sun, Daniel Reyes and Omar Haddad cut to 8 hrs.'},
      {title:'Manager · today', body:'Remove Juan Lopez\'s Saturday shift (approved vacation) and decide Sofia Bagley\'s pending request.'},
      {title:'Manager · weekend template', body:'Cap shifts at 8 hrs. That clears all 24 Daily OT warnings and lifts warning-free shifts from 63.3% to about 87%.'},
    ],
  },
  {
    id:103, group:'weekly', badge:'sev-warn', badgeText:'Warning', short:'Time Off',
    title:'9 time-off requests: 3 approved on Friday left the line short, 5 are still waiting for a decision',
    meta:'Week of Sep 01 + next 2 weeks · 4 Approved · 5 Pending · 2 overlap a scheduled shift',
    impact:'5 pending', tags:['2 overlaps','3 Fri unassigned'],
    chips:[{l:'Requests',v:'9',c:''},{l:'Approved',v:'4',c:''},{l:'Pending',v:'5',c:'neg'},{l:'Overlap a Shift',v:'2',c:'neg'},{l:'Shifts Not Re-filled',v:'3',c:'neg'}],
    rootPoints:[
      'Approved time off left <b>3 Friday shifts Unassigned</b> and nobody has been assigned → Friday understaffed from 4:00 PM to close (see Unassigned Shifts)',
      '<b>Juan Lopez</b> was approved for Saturday after the schedule was built and is still on it',
      '<b>5 requests are pending</b>, 4 of them for Sep 18 – 20 (Sofia Bagley, Cecilia Ramirez), the same requests shown under Needing Action on the dashboard',
      'Sofia Bagley\'s Sat 09/06 request has waited <b>9 days</b> and overlaps a scheduled shift',
    ],
    tableLabel:'Time-off requests', tableSub:'Requests affecting this week and the next 2 weeks',
    tableHeaders:['Employee','Role','Requested Date','Time Off Day(s)','Requested Reason','Status','Schedule Impact'],
    tableRows:[
      ['Luis Hernandez','Line Cook','08/18','Fri 09/05 · All Day','Family trip','Approved','Shift left Unassigned'],
      ['Diego Ruiz','Line Cook','08/25','Fri 09/05 · All Day','Moving apartments','Approved','Shift left Unassigned'],
      ['Maria Santos','Line Cook','09/04','Fri 09/05 · All Day','Doctor appointment','Approved','Shift left Unassigned'],
      ['Juan Lopez','Line Cook','08/20','Sat 09/06 · All Day','Family wedding','Approved','Still scheduled 4:00 PM – 11:30 PM'],
      ['Sofia Bagley','GSA','08/28','Sat 09/06 · All Day','Personal errand','Pending','Scheduled 4:00 PM – 10:50 PM'],
      ['Sofia Bagley','GSA','09/02','Fri 09/18 · All Day','Class schedule','Pending','Decide before the Sep 14 schedule'],
      ['Cecilia Ramirez','GSA','09/03','Sat 09/19 · All Day','Out of town','Pending','Decide before the Sep 14 schedule'],
      ['Sofia Bagley','GSA','09/03','Sat 09/19 · 4:00 PM – 11:45 PM','Class schedule','Pending','Decide before the Sep 14 schedule'],
      ['Cecilia Ramirez','GSA','09/03','Sun 09/20 · All Day','Out of town','Pending','Decide before the Sep 14 schedule'],
    ],
    tableRowTone:['bad','bad','bad','bad','warn','warn','warn','warn','warn'],
    recommendation:'3 actions for the manager: this week and before the Sep 14 schedule is published.',
    actions:[
      {title:'Manager · today', body:'Remove Juan Lopez\'s Saturday shift and decide Sofia Bagley\'s Sat 09/06 request.'},
      {title:'Manager · before publishing Sep 14', body:'Decide the 4 pending requests for Sep 18 – 20. Two employees are off on Sat 09/19, so line up cover before approving (Liam Rodriguez, Isabella Flores are under 11 hrs).'},
      {title:'Manager · going forward', body:'When time off is approved, open the shift for pick-up instead of deleting it.'},
    ],
  },
  {
    id:104, group:'weekly', badge:'sev-warn', badgeText:'Warning', short:'Weekend Overtime',
    title:'All 27.74 hours of scheduled overtime come from weekend shifts longer than 8 hours',
    meta:'Week of Sep 01 · $853.30 scheduled OT · 24 shifts · Sat + Sun only',
    impact:'$853.30 OT', tags:['24 shifts > 8 hrs','24 covers suggested'],
    chips:[{l:'Scheduled OT Hours',v:'27.74 hrs',c:'neg'},{l:'Scheduled OT $',v:'$853.30',c:'neg'},{l:'Shifts Over 8 Hrs',v:'24',c:''},{l:'Suggested Covers',v:'24 of 24',c:'pos'},{l:'Last Week OT',v:'0.48 hrs',c:''}],
    rootPoints:[
      'Nobody is near 40 hrs (highest: <b>Priya Nair 29.45 hrs</b>), so every OT hour is <b>daily OT</b> from shift length',
      '<b>24 of 34</b> weekend shifts are over 8 hrs',
      'Managers hold <b>49% of OT $</b> ($417.27): an OT hour costs $42.00 for a GM and $34.50 for an AM',
      'Weekend is <b>73.02 hrs over forecast</b>, so the OT isn\'t needed for coverage',
    ],
    tableLabel:'Scheduled OT by shift', tableSub:'Sat + Sun · hours past 8 paid at 1.5× · suggested employee is free that day, no time off, same position first, stays under 40 hrs',
    tableHeaders:['Employee','Role','Day','Shift Schedule Time','OT Hrs','OT $','Suggested Employee','Covers'],
    tableRows:[
      ['Daniel Reyes','General Manager','Sat 09/06','7:00 AM – 5:25 PM','2.38 hrs','$99.96','Priya Nair (29.45 hrs)','3:00 PM – 5:25 PM'],
      ['Graciela Atempa','Assistant Manager','Sat 09/06','10:00 AM – 7:50 PM','1.82 hrs','$62.79','Hannah Cho (17.23 hrs)','6:00 PM – 7:50 PM'],
      ['Marcus Bell','Assistant Manager','Sat 09/06','2:30 PM – 12:10 AM','1.67 hrs','$57.62','Omar Haddad (23.48 hrs)','10:30 PM – 12:10 AM'],
      ['Kimberli Lopez','Shift Leader','Sat 09/06','6:30 AM – 4:10 PM','1.69 hrs','$49.43','Chris Walker (11.58 hrs)','2:30 PM – 4:10 PM'],
      ['Nicole Ramos','Line Cook','Sat 09/06','3:00 PM – 12:35 AM','1.58 hrs','$40.29','Kevin Tran (5.37 hrs)','11:00 PM – 12:35 AM'],
      ['Tyler Brooks','Shift Leader','Sat 09/06','2:00 PM – 11:15 PM','1.23 hrs','$35.98','Ana Morales (12.17 hrs)','10:00 PM – 11:15 PM'],
      ['Ethan Kim','Line Cook','Sat 09/06','8:00 AM – 5:15 PM','1.22 hrs','$31.11','Carlos Mendoza (5.39 hrs)','4:00 PM – 5:15 PM'],
      ['Pedro Alvarez','Line Cook','Sat 09/06','10:30 AM – 7:15 PM','0.72 hrs','$18.36','Jasmine Ortiz (5.81 hrs)','6:30 PM – 7:15 PM'],
      ['Chloe Adams','GSA','Sat 09/06','11:00 AM – 7:40 PM','0.66 hrs','$16.34','Liam Rodriguez (10.30 hrs)','7:00 PM – 7:40 PM'],
      ['Mason Clark','GSA','Sat 09/06','3:00 PM – 11:35 PM','0.61 hrs','$15.10','Isabella Flores (10.35 hrs)','11:00 PM – 11:35 PM'],
      ['Tomas Vega','Dishwasher','Sat 09/06','4:00 PM – 12:35 AM','0.58 hrs','$13.49','Brian Scott (4.30 hrs)','12:00 AM – 12:35 AM'],
      ['Lucas White','GSA','Sat 09/06','10:00 AM – 6:20 PM','0.31 hrs','$7.67','Ava Thompson (12.73 hrs)','6:00 PM – 6:20 PM'],
      ['Priya Nair','General Manager','Sun 09/07','7:15 AM – 4:55 PM','1.69 hrs','$70.98','Daniel Reyes (24.84 hrs)','3:15 PM – 4:55 PM'],
      ['Omar Haddad','Assistant Manager','Sun 09/07','2:45 PM – 12:45 AM','2.01 hrs','$69.35','Marcus Bell (16.57 hrs)','10:45 PM – 12:45 AM'],
      ['Hannah Cho','Assistant Manager','Sun 09/07','10:15 AM – 7:55 PM','1.64 hrs','$56.58','Graciela Atempa (17.21 hrs)','6:15 PM – 7:55 PM'],
      ['Mei Tanaka','Shift Leader','Sun 09/07','6:45 AM – 4:35 PM','1.86 hrs','$54.41','Chris Walker (11.58 hrs)','2:45 PM – 4:35 PM'],
      ['Eliza Funes','Line Cook','Sun 09/07','10:45 AM – 8:15 PM','1.48 hrs','$37.74','Kevin Tran (5.37 hrs)','6:45 PM – 8:15 PM'],
      ['Cecilia Ramirez','GSA','Sun 09/07','11:15 AM – 8:20 PM','1.09 hrs','$26.98','Liam Rodriguez (10.30 hrs)','7:15 PM – 8:20 PM'],
      ['Austin Gray','GSA','Sun 09/07','10:15 AM – 7:15 PM','0.96 hrs','$23.76','Isabella Flores (10.35 hrs)','6:15 PM – 7:15 PM'],
      ['Olivia Martinez','GSA','Sun 09/07','3:15 PM – 12:10 AM','0.95 hrs','$23.51','Sofia Bagley (11.66 hrs)','11:15 PM – 12:10 AM'],
      ['Jordan Price','Shift Leader','Sun 09/07','2:15 PM – 10:55 PM','0.66 hrs','$19.31','Ana Morales (12.17 hrs)','10:15 PM – 10:55 PM'],
      ['Hector Cruz','Dishwasher','Sun 09/07','4:15 PM – 12:40 AM','0.45 hrs','$10.46','Brian Scott (4.30 hrs)','12:15 AM – 12:40 AM'],
      ['Luis Hernandez','Line Cook','Sun 09/07','3:15 PM – 11:35 PM','0.30 hrs','$7.65','Carlos Mendoza (5.39 hrs)','11:15 PM – 11:35 PM'],
      ['Noah Davis','GSA','Sun 09/07','4:15 PM – 12:25 AM','0.18 hrs','$4.46','Mason Clark (13.01 hrs)','12:15 AM – 12:25 AM'],
    ],
    tableRowTone:['bad','bad','bad','bad','warn','warn','warn','warn','warn','warn','warn','warn','bad','bad','bad','bad','warn','warn','warn','warn','warn','warn','warn','warn'],
    recommendation:'3 actions for the manager on the weekend template.',
    actions:[
      {title:'Manager · weekend template', body:'Cap Sat/Sun shifts at 8 hrs, starting with the 6 GM/AM shifts ($417.27). Removes all $853.30 of OT.'},
      {title:'Manager · if you need the coverage', body:'Give the hours past 8 to the Suggested Employee in each row instead of paying OT. Each one is free that day, in the same position and stays under 40 hrs.'},
      {title:'Manager · before publish', body:'Turn on the 8-hour daily check so any shift over 8 hrs is flagged before the schedule is published.'},
    ],
  },
  {
    id:105, group:'weekly', badge:'sev-warn', badgeText:'Warning', short:'Unpublished Shifts',
    title:'8 shifts are unpublished, so 7 employees don\'t have these shift details yet',
    meta:'Week of Sep 01 · Tue 3 · Wed 3 · Fri 2 · 44.56 unpublished hrs',
    impact:'8 unpublished', tags:['Tue 3 · Wed 3 · Fri 2','Priya Nair ×2'],
    chips:[{l:'Unpublished Shifts',v:'8',c:'neg'},{l:'Unpublished Hrs',v:'44.56 hrs',c:'neg'},{l:'Days Affected',v:'3',c:''},{l:'Employees Affected',v:'7',c:''},{l:'Published Shifts',v:'90 of 98',c:''}],
    rootPoints:[
      '<b>8 shifts (44.56 hrs) are unpublished</b> on the schedule pad: they have not been sent to the employees',
      'All 8 are <b>opening and mid-day shifts</b> on Tue, Wed and Fri; Priya Nair (GM) has 2 of them',
      'Until the schedule is published, these <b>7 employees don\'t have the shift details</b> (date and time) for these shifts',
    ],
    tableLabel:'Unpublished shifts', tableSub:'Week of Sep 01 · shifts not yet sent to the employee',
    tableHeaders:['Employee','Role','Date','Shift Schedule Time','Sch Hrs','Status'],
    tableRows:[
      ['Daniel Reyes','General Manager','Tue 09/02','7:00 AM – 1:35 PM','6.57 hrs','Unpublished · not sent to employee'],
      ['Luis Hernandez','Line Cook','Tue 09/02','3:00 PM – 8:30 PM','5.52 hrs','Unpublished · not sent to employee'],
      ['Aaliyah Brown','Dishwasher','Tue 09/02','10:30 AM – 3:35 PM','5.05 hrs','Unpublished · not sent to employee'],
      ['Priya Nair','General Manager','Wed 09/03','7:15 AM – 1:45 PM','6.54 hrs','Unpublished · not sent to employee'],
      ['Kevin Tran','Line Cook','Wed 09/03','3:15 PM – 8:35 PM','5.37 hrs','Unpublished · not sent to employee'],
      ['Hector Cruz','Dishwasher','Wed 09/03','10:45 AM – 3:00 PM','4.23 hrs','Unpublished · not sent to employee'],
      ['Priya Nair','General Manager','Fri 09/05','7:15 AM – 2:00 PM','6.71 hrs','Unpublished · not sent to employee'],
      ['Grace Park','Prep Cook','Fri 09/05','9:15 AM – 1:50 PM','4.57 hrs','Unpublished · not sent to employee'],
    ],
    tableRowTone:['bad','bad','bad','bad','bad','bad','bad','bad'],
    recommendation:'2 actions for the manager.',
    actions:[
      {title:'Manager · today', body:'Publish the schedule so all 8 shifts reach the 7 employees.'},
      {title:'Manager · going forward', body:'Check "Show Unpublished Shifts" on the schedule pad before the week starts, so no shift is left unpublished.'},
    ],
  },
  {
    id:106, group:'weekly', badge:'sev-alert', badgeText:'Alert', short:'Unassigned Shifts',
    title:'3 Unassigned shifts on Friday (17.50 hrs) have no employee, and each has an available best match',
    meta:'Week of Sep 01 · Fri 09/05 · 3 Line Cook shifts left open by approved time off · "Cannot publish unassigned Shifts"',
    impact:'3 unassigned', tags:['17.50 hrs','3 best matches'],
    chips:[{l:'Unassigned Shifts',v:'3',c:'neg'},{l:'Unassigned Hrs',v:'17.50 hrs',c:'neg'},{l:'Best Matches Found',v:'3 of 3',c:'pos'},{l:'Friday Understaffed Hrs',v:'7.89 hrs',c:'neg'},{l:'Position',v:'Line Cook',c:''}],
    rootPoints:[
      '<b>3 shifts sit on the Unassigned row</b> for Fri 09/05; the schedule pad won\'t publish them until each has an employee',
      'Without them Friday is <b>7.89 hrs understaffed from 4:00 PM to close</b>; filling them covers 7.15 of those hours',
      'Best matches are Line Cooks who are free on Friday, have no time off and stay well under 40 hrs',
    ],
    tableLabel:'Unassigned shifts', tableSub:'Fri 09/05 · shifts with no employee, from the Unassigned row',
    tableHeaders:['Unassigned Shift','Position','Hrs','Status','Best Match','Week Hrs After'],
    tableRowIcon:['alert','alert','alert'],
    tableRows:[
      ['Fri 09/05 · 10:30 AM – 5:00 PM','Line Cook','6.50 hrs','Unassigned · cannot be published','Kevin Tran','11.87 hrs'],
      ['Fri 09/05 · 3:00 PM – 9:00 PM','Line Cook','6.00 hrs','Unassigned · cannot be published','Carlos Mendoza','11.39 hrs'],
      ['Fri 09/05 · 4:00 PM – 9:00 PM','Line Cook','5.00 hrs','Unassigned · cannot be published','Rosa Delgado','10.87 hrs'],
    ],
    tableRowTone:['bad','bad','bad'],
    noTotal:true,
    table2:{ label:'Suggested employees', sub:'Available and best match for each unassigned shift (same position, no time off, fewest hours)', noTotal:true,
      headers:['Employee','Role','For Shift','Hrs This Week','Time Off','Availability','Match'],
      rows:[
        ['Kevin Tran','Line Cook','10:30 AM – 5:00 PM','5.37 hrs','None','Available','Best match'],
        ['Carlos Mendoza','Line Cook','10:30 AM – 5:00 PM','5.39 hrs','None','Available','Backup'],
        ['Carlos Mendoza','Line Cook','3:00 PM – 9:00 PM','5.39 hrs','None','Available','Best match'],
        ['Rosa Delgado','Line Cook','3:00 PM – 9:00 PM','5.87 hrs','None','Available','Backup'],
        ['Rosa Delgado','Line Cook','4:00 PM – 9:00 PM','5.87 hrs','None','Available','Best match'],
        ['Andre Wilson','Line Cook','4:00 PM – 9:00 PM','6.18 hrs','None','Available','Backup'],
      ],
      tone:['good','ok','good','ok','good','ok'] },
    recommendation:'4 actions for the manager before Friday\'s schedule is published.',
    actions:[
      {title:'Manager · today', body:'Assign Kevin Tran to the 10:30 AM – 5:00 PM Line Cook shift (week goes to 11.87 hrs); backup Carlos Mendoza.'},
      {title:'Manager · today', body:'Assign Carlos Mendoza to the 3:00 PM – 9:00 PM Line Cook shift (week goes to 11.39 hrs); backup Rosa Delgado.'},
      {title:'Manager · today', body:'Assign Rosa Delgado to the 4:00 PM – 9:00 PM Line Cook shift (week goes to 10.87 hrs); backup Andre Wilson.'},
      {title:'Manager · then', body:'Publish the schedule once every shift has an employee.'},
    ],
  },
];

/* weekly insights (static, week of Sep 01); daily ones come from siInsBuildDaily(date) */
const SI_INS_WEEKLY = SI_INS_ALL.slice();

/* icon shown in the left-list circle per insight id (see ICONS map in insights-render.js) */
const SI_INS_LIST_ICON = {
  0:'alert', 1:'users', 2:'users', 3:'dollar', 4:'calendar', 5:'clock',
  100:'dollar', 101:'users', 102:'alert', 103:'calendar', 104:'clock', 105:'doc', 106:'calendar',
};

if (typeof window !== 'undefined') {
  window.SI_INS_ALL = SI_INS_ALL;
  window.SI_INS_WEEKLY = SI_INS_WEEKLY;
  window.SI_INS_LIST_ICON = SI_INS_LIST_ICON;
}
