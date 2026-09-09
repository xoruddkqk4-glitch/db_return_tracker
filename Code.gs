const SPREADSHEET_ID = '1HARxvAUNLEI_InOhMKoz3fMJpPUOe9QBePHkQnb8gjY';

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('DB Return Tracker - 디벗 양품화 제출 현황')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

let _ssInstance = null;
function getSpreadsheet() {
  if (!_ssInstance) {
    _ssInstance = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _ssInstance;
}

// 0. 초기 데이터 통합 불러오기 (단일 RPC 고속 통신)
function getInitialData() {
  return {
    students: getStudentList(),
    teachers: getTeacherList()
  };
}

// 1. 학생 명단 전체 불러오기 (CacheService 캐싱으로 고속화)
function getStudentList() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('STUDENT_LIST_CACHE');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('학생명단');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const list = data.slice(1).filter(r => r[4]).map(row => ({
    grade: String(row[1]),
    classNum: String(row[2]),
    num: String(row[3]),
    studentId: String(row[4]),
    name: String(row[5])
  }));

  try {
    cache.put('STUDENT_LIST_CACHE', JSON.stringify(list), 1200); // 20분 캐싱
  } catch (e) {}

  return list;
}

// 2. 학생 제출 처리 (등록 또는 수정)
function submitStudentData(formData) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('제출현황');

  if (!sheet) {
    sheet = ss.insertSheet('제출현황');
  }

  let data = sheet.getDataRange().getValues();

  // 헤더 검사 및 '답변 시간' 열(7번째 열) 자동 보정
  if (data.length === 0 || (data.length > 0 && data[0].length === 0)) {
    const headers = [
      '순번', '학년', '반', '번호', '학번', '이름', '답변 시간',
      '1.기기', '2.큰박스', '3.어댑터', '4.케이블', '5.펜', '6.홀더', '7.작은박스', '8.점검표'
    ];
    sheet.appendRow(headers);
    data = sheet.getDataRange().getValues();
  } else if (data[0].length < 15 || String(data[0][6]).trim() !== '답변 시간') {
    sheet.insertColumnBefore(7);
    sheet.getRange(1, 7).setValue('답변 시간');
    data = sheet.getDataRange().getValues();
  }

  const studentId = String(formData.studentId);
  let targetRowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][4]) === studentId) {
      targetRowIndex = i + 1; // 1-based index
      break;
    }
  }

  const now = new Date();
  const timestamp = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

  const qKeys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
  const qValues = qKeys.map(k => (formData[k] === '제출' ? 1 : ''));
  const qColors = qKeys.map(k => (formData[k] === '제출' ? '#ffffff' : '#fce8e6'));

  const rowValues = [
    targetRowIndex > 0 ? data[targetRowIndex - 1][0] : Math.max(data.length, 1),
    formData.grade,
    formData.classNum,
    formData.num,
    formData.studentId,
    formData.name,
    timestamp,
    ...qValues
  ];

  if (targetRowIndex > 0) {
    sheet.getRange(targetRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    sheet.getRange(targetRowIndex, 8, 1, 8).setBackgrounds([qColors]);
  } else {
    sheet.appendRow(rowValues);
    const newRowIndex = sheet.getLastRow();
    sheet.getRange(newRowIndex, 8, 1, 8).setBackgrounds([qColors]);
  }

  return { success: true, name: formData.name, studentId: formData.studentId, timestamp: timestamp };
}

// 3. 교사 로그인 및 담임교사 목록 불러오기 (CacheService 캐싱)
function getTeacherList() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('TEACHER_LIST_CACHE');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('담임교사명단');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const list = data.slice(1).filter(r => r[0]).map(row => ({
    className: String(row[0]),
    name: String(row[1])
  }));

  try {
    cache.put('TEACHER_LIST_CACHE', JSON.stringify(list), 1200); // 20분 캐싱
  } catch (e) {}

  return list;
}

function verifyTeacherLogin(className, password) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('담임교사명단');
  if (!sheet) return { success: false, message: '담임교사명단 시트를 찾을 수 없습니다.' };
  const data = sheet.getDataRange().getValues();

  const targetClass = String(className).trim();
  const inputPw = String(password).trim();
  const isAdminTarget = (targetClass === '0' || targetClass === 'ALL' || targetClass === '관리자' || targetClass === '업무담당자');

  for (let i = 1; i < data.length; i++) {
    const curClass = String(data[i][0]).trim();
    const curName = String(data[i][1]).trim();
    const curPw = String(data[i][2]).trim();

    const isMatch = isAdminTarget
      ? (curClass === '0' || curClass === '관리자' || curClass === 'ALL' || curClass === '전체' || curClass === '업무담당자')
      : (curClass === targetClass);

    if (isMatch && curPw === inputPw) {
      return {
        success: true,
        className: targetClass,
        teacherName: curName || (isAdminTarget ? '업무담당자' : '선생님')
      };
    }
  }
  return { success: false, message: '비밀번호가 일치하지 않습니다.' };
}

// 4. 교사용 대시보드 데이터 조회 (캐시 명단 + 루프 최적화)
function getTeacherDashboardData(selectedClass) {
  const studentList = getStudentList();

  const ss = getSpreadsheet();
  const statusSheet = ss.getSheetByName('제출현황');
  const statusData = statusSheet ? statusSheet.getDataRange().getValues().slice(1) : [];

  const statusMap = {};
  for (let i = 0; i < statusData.length; i++) {
    const row = statusData[i];
    const sId = String(row[4]);
    if (!sId) continue;

    const hasTimestampCol = row.length >= 15 || String(row[6]).includes('-') || String(row[6]).includes(':');
    const offset = hasTimestampCol ? 1 : 0;

    const q1 = row[6 + offset], q2 = row[7 + offset], q3 = row[8 + offset], q4 = row[9 + offset];
    const q5 = row[10 + offset], q6 = row[11 + offset], q7 = row[12 + offset], q8 = row[13 + offset];

    statusMap[sId] = {
      timestamp: hasTimestampCol && row[6] ? String(row[6]) : '',
      q1: (q1 === 1 || String(q1) === '1' || q1 === '제출') ? '제출' : '미제출',
      q2: (q2 === 1 || String(q2) === '1' || q2 === '제출') ? '제출' : '미제출',
      q3: (q3 === 1 || String(q3) === '1' || q3 === '제출') ? '제출' : '미제출',
      q4: (q4 === 1 || String(q4) === '1' || q4 === '제출') ? '제출' : '미제출',
      q5: (q5 === 1 || String(q5) === '1' || q5 === '제출') ? '제출' : '미제출',
      q6: (q6 === 1 || String(q6) === '1' || q6 === '제출') ? '제출' : '미제출',
      q7: (q7 === 1 || String(q7) === '1' || q7 === '제출') ? '제출' : '미제출',
      q8: (q8 === 1 || String(q8) === '1' || q8 === '제출') ? '제출' : '미제출'
    };
  }

  const isAdminMode = (
    selectedClass === '0' || selectedClass === 'ALL' || selectedClass === '관리자' || selectedClass === '업무담당자' ||
    String(selectedClass).startsWith('0') || String(selectedClass).includes('관리자') || String(selectedClass).includes('업무담당자')
  );

  const resultList = [];
  const defaultStatus = {
    timestamp: '',
    q1: '미제출', q2: '미제출', q3: '미제출', q4: '미제출',
    q5: '미제출', q6: '미제출', q7: '미제출', q8: '미제출'
  };

  for (let i = 0; i < studentList.length; i++) {
    const student = studentList[i];
    const fullClassStr = `${student.grade}-${student.classNum}`;

    if (!isAdminMode && fullClassStr !== selectedClass && student.classNum !== selectedClass) {
      continue;
    }

    const st = statusMap[student.studentId] || defaultStatus;
    const isAllComplete = (
      st.q1 === '제출' && st.q2 === '제출' && st.q3 === '제출' && st.q4 === '제출' &&
      st.q5 === '제출' && st.q6 === '제출' && st.q7 === '제출' && st.q8 === '제출'
    );

    resultList.push({
      grade: student.grade,
      classNum: student.classNum,
      num: student.num,
      studentId: student.studentId,
      name: student.name,
      status: st,
      isComplete: isAllComplete
    });
  }

  return resultList;
}