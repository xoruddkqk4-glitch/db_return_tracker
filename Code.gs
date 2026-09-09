const SPREADSHEET_ID = '1HARxvAUNLEI_InOhMKoz3fMJpPUOe9QBePHkQnb8gjY';

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('DB Return Tracker - 디벗 양품화 제출 현황')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// 1. 학생 명단 전체 불러오기 (학번으로 이름 자동 매칭용)
function getStudentList() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('학생명단');
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  // 헤더 제외: 순번(0), 학년(1), 반(2), 번호(3), 학번(4), 이름(5)
  return data.slice(1).map(row => ({
    grade: String(row[1]),
    classNum: String(row[2]),
    num: String(row[3]),
    studentId: String(row[4]),
    name: String(row[5])
  }));
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
      '1.기기', '2.큰박스', '3.어댑터', '4.케이블', '5.펜', '6.홀더', '7.점검표', '8.작은박스'
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
  
  // 기존에 제출한 기록이 있는지 학번으로 조회
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][4]) === studentId) {
      targetRowIndex = i + 1; // 1-based index
      break;
    }
  }

  // 서울 시간 기준 답변 시간 생성 (yyyy-MM-dd HH:mm:ss)
  const now = new Date();
  const timestamp = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

  // q1 ~ q8 항목 변환 ('제출' -> 1, '미제출' -> '')
  const qKeys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
  const qValues = qKeys.map(k => (formData[k] === '제출' ? 1 : ''));
  const qColors = qKeys.map(k => (formData[k] === '제출' ? '#ffffff' : '#fce8e6')); // 파스텔 빨강: #fce8e6

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

// 3. 교사 로그인 및 담임교사 목록 불러오기
function getTeacherList() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('담임교사명단');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  // 학급(0), 이름(1), 비번(2)
  return data.slice(1).map(row => ({
    className: String(row[0]),
    name: String(row[1])
  }));
}

function verifyTeacherLogin(className, password) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('담임교사명단');
  if (!sheet) return { success: false, message: '담임교사명단 시트를 찾을 수 없습니다.' };
  const data = sheet.getDataRange().getValues();
  
  const targetClass = String(className).trim();
  const inputPw = String(password).trim();

  for (let i = 1; i < data.length; i++) {
    const curClass = String(data[i][0]).trim();
    const curName = String(data[i][1]).trim();
    const curPw = String(data[i][2]).trim();

    const isMatch = (targetClass === 'ALL' && (curClass === '관리자' || curClass === 'ALL' || curClass === '전체')) ||
                    (curClass === targetClass);

    if (isMatch && curPw === inputPw) {
      return { 
        success: true, 
        className: targetClass, 
        teacherName: curName || '관리자' 
      };
    }
  }
  return { success: false, message: '비밀번호가 일치하지 않습니다.' };
}

// 4. 교사용 대시보드 데이터 조회 (학생명단 + 제출현황 병합)
function getTeacherDashboardData(selectedClass) {
  const ss = getSpreadsheet();
  
  // 학생 명단
  const studentSheet = ss.getSheetByName('학생명단');
  const studentData = studentSheet ? studentSheet.getDataRange().getValues().slice(1) : [];
  
  // 제출 현황
  const statusSheet = ss.getSheetByName('제출현황');
  const statusData = statusSheet ? statusSheet.getDataRange().getValues().slice(1) : [];
  
  // 제출 현황 맵 생성 (Key: 학번)
  const statusMap = {};
  statusData.forEach(row => {
    const sId = String(row[4]);
    const hasTimestampCol = row.length >= 15 || String(row[6]).includes('-') || String(row[6]).includes(':');
    const offset = hasTimestampCol ? 1 : 0;

    const parseSubmitted = (val) => (val === 1 || String(val) === '1' || val === '제출') ? '제출' : '미제출';

    statusMap[sId] = {
      timestamp: hasTimestampCol && row[6] ? String(row[6]) : '',
      q1: parseSubmitted(row[6 + offset]),
      q2: parseSubmitted(row[7 + offset]),
      q3: parseSubmitted(row[8 + offset]),
      q4: parseSubmitted(row[9 + offset]),
      q5: parseSubmitted(row[10 + offset]),
      q6: parseSubmitted(row[11 + offset]),
      q7: parseSubmitted(row[12 + offset]),
      q8: parseSubmitted(row[13 + offset])
    };
  });

  const resultList = [];

  studentData.forEach(row => {
    const grade = String(row[1]);
    const classNum = String(row[2]);
    const num = String(row[3]);
    const studentId = String(row[4]);
    const name = String(row[5]);
    const fullClassStr = `${grade}-${classNum}`;

    // 특정 학급 필터링 ('ALL'이면 전체)
    if (selectedClass !== 'ALL' && fullClassStr !== selectedClass && classNum !== selectedClass) {
      return;
    }

    const st = statusMap[studentId] || {
      timestamp: '',
      q1: '미제출', q2: '미제출', q3: '미제출', q4: '미제출',
      q5: '미제출', q6: '미제출', q7: '미제출', q8: '미제출'
    };

    // 8개 항목 모두 '제출'이면 최종 완료
    const isAllComplete = (
      st.q1 === '제출' && st.q2 === '제출' && st.q3 === '제출' && st.q4 === '제출' &&
      st.q5 === '제출' && st.q6 === '제출' && st.q7 === '제출' && st.q8 === '제출'
    );

    resultList.push({
      grade,
      classNum,
      num,
      studentId,
      name,
      status: st,
      isComplete: isAllComplete
    });
  });

  return resultList;
}