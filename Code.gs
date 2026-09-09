const SPREADSHEET_ID = '1HARxvAUNLEI_InOhMKoz3fMJpPUOe9QBePHkQnb8gjY';

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
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
  const sheet = ss.getSheetByName('제출현황');
  const data = sheet.getDataRange().getValues();
  
  const studentId = String(formData.studentId);
  let targetRowIndex = -1;
  
  // 기존에 제출한 기록이 있는지 학번으로 조회
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][4]) === studentId) {
      targetRowIndex = i + 1; // 1-based index
      break;
    }
  }

  const rowValues = [
    targetRowIndex > 0 ? data[targetRowIndex - 1][0] : data.length, // 순번 유지 또는 신규
    formData.grade,
    formData.classNum,
    formData.num,
    formData.studentId,
    formData.name,
    formData.q1 || '미제출', // 디벗 기기를 학급 디벗함 본인의 번호에 제출하였는가?
    formData.q2 || '미제출', // 가방에 학번&이름 라벨지를 붙인 후, 큰 박스에 제출하였는가?
    formData.q3 || '미제출', // 충전 어댑터를 제출하였는가?
    formData.q4 || '미제출', // 충전 케이블을 제출하였는가?
    formData.q5 || '미제출', // 스타일러스 펜을 제출하였는가?
    formData.q6 || '미제출', // usb 형태의 펜 홀더를 제출하였는가?
    formData.q7 || '미제출', // 디벗 반납 점검표'를 작성하여 담임선생님에게 제출하였는가?
    formData.q8 || '미제출'  // 지퍼백에 학번&이름 라벨지를 붙인 후, 작은 박스에 제출하였는가?
  ];

  if (targetRowIndex > 0) {
    sheet.getRange(targetRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return { success: true, name: formData.name, studentId: formData.studentId };
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
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const curClass = String(data[i][0]);
    const curPw = String(data[i][2]);
    if (curClass === className && curPw === String(password)) {
      return { success: true, className: curClass, teacherName: String(data[i][1]) };
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
    statusMap[sId] = {
      q1: row[6] || '미제출',
      q2: row[7] || '미제출',
      q3: row[8] || '미제출',
      q4: row[9] || '미제출',
      q5: row[10] || '미제출',
      q6: row[11] || '미제출',
      q7: row[12] || '미제출',
      q8: row[13] || '미제출'
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