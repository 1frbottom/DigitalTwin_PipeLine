


// misc funcs --------------------------------------------------

  // 혼잡도
function getColorByLevel(level) {
  if (!level) return { color: "#9ca3af", className: "tag" };

  if (level.includes("여유")) {
    return { color: "#10b981", bg: "#dcfce7", className: "tag" };
  } else if (level.includes("보통")) {
    return { color: "#2f80ed", bg: "#e3f2ff", className: "tag" };
  } else if (level.includes("약간 붐빔")) {
    return { color: "#f59e0b", bg: "#fef3c7", className: "tag tag-amber" };
  } else if (level.includes("붐빔")) {
    return { color: "#ef4444", bg: "#fee2e2", className: "tag tag-danger" };
  } else {
    return { color: "#6b7280", bg: "#f3f4fa", className: "tag" };
  }
}

// 백엔드 API 호출 함수 -----------------------------------------

  // 실시간 도시데이터 - 인구현황 (city_live_ppltn_proc)
async function fetchPopulationData() {
  try {
    const response = await fetch("http://localhost:8000/city/population/current?area_name=강남역");
    if (!response.ok) throw new Error("Current API Error");
    const data = await response.json();

    // (1) 혼잡도 태그 업데이트
    const congestEl = document.getElementById("pop-congest");
    const styleInfo = getColorByLevel(data.congest_lvl);
    
    congestEl.textContent = data.congest_lvl;
    congestEl.className = styleInfo.className;
    
    // 태그 배경색/글자색 강제 적용 (CSS 클래스 외 커스텀 필요시)
    if (data.congest_lvl.includes("여유") || data.congest_lvl.includes("보통")) {
        congestEl.style.backgroundColor = styleInfo.bg;
        congestEl.style.color = styleInfo.color;
    } else {
        congestEl.style.backgroundColor = ""; // 클래스 스타일 따름
        congestEl.style.color = "";
    }

    // (2) 인구수 업데이트
    document.getElementById("pop-min").textContent = data.ppltn_min.toLocaleString("ko-KR");
    document.getElementById("pop-max").textContent = data.ppltn_max.toLocaleString("ko-KR");
    
    // (3) 기준 시간 업데이트
    const dbTime = new Date(data.ppltn_time);
    const timeString = dbTime.toLocaleString("ko-KR", {
      year: 'numeric', month: 'numeric', day: 'numeric', 
      hour: '2-digit', minute: '2-digit'
    });
    document.getElementById("pop-time").textContent = `${timeString} 기준`;

  } catch (error) {
    console.error("인구 현황 수신 실패:", error);
  }
}

  // 실시간 도시데이터 : 인구현황 -> 예측 (city_live_ppltn_forecast)
async function fetchForecastData() {
  try {
    const response = await fetch("http://localhost:8000/city/population/forecast?area_name=강남역");
    
    // 컨테이너 확인 (HTML에 id="forecast-chart"가 없으면 중단)
    const container = document.getElementById("forecast-chart");
    if (!container) {
        console.warn("HTML에 'forecast-chart' ID를 가진 요소가 없습니다.");
        return;
    }

    container.innerHTML = ""; // 초기화

    if (!response.ok) {
        container.innerHTML = "<span style='font-size:11px; color:#9ca3af; width:100%; text-align:center;'>예측 데이터 없음</span>";
        return;
    }

    const list = await response.json();
    
    // 데이터가 비어있는 경우 처리
    if (!list || list.length === 0) {
        container.innerHTML = "<span style='font-size:11px; color:#9ca3af; width:100%; text-align:center;'>예측 데이터 준비중</span>";
        return;
    }

    const next6 = list.slice(0, 6);

    //스케일링 로직 변경: 0 기준이 아니라 (최소값 ~ 최대값) 범위 기준으로 변경
    const values = next6.map(d => d.fcst_max);
    const minVal = Math.min(...values); // 6개 중 가장 작은 값
    const maxVal = Math.max(...values); // 6개 중 가장 큰 값
    const range = maxVal - minVal;      // 값의 범위

    next6.forEach(item => {
        // 시간 파싱
        const fTime = new Date(item.fcst_time);
        const hourLabel = fTime.getHours() + "시";
        const styleInfo = getColorByLevel(item.fcst_congest_lvl);

        // 상대적 높이 계산 (최소 20% ~ 최대 100% 사이로 매핑)
        let heightPercent = 100; // 기본값 (데이터가 다 같을 경우)
        
        if (range > 0) {
            // (내 값 - 최소값) / 범위 * 80 + 20
            // 즉, 꼴찌는 20% 높이, 1등은 100% 높이를 가짐
            const ratio = (item.fcst_max - minVal) / range;
            heightPercent = 20 + (ratio * 80);
        }

        // HTML 조립
        const barHtml = `
            <div class="forecast-item">
                <div class="bar-graph" 
                     title="${item.fcst_congest_lvl} (${item.fcst_min.toLocaleString()}~${item.fcst_max.toLocaleString()}명)" 
                     style="height: ${heightPercent}%; background-color: ${styleInfo.color};">
                </div>
                <div class="time-label">${hourLabel}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', barHtml);
    });

  } catch (error) {
    console.error("예측 데이터 수신 실패:", error);
  }
}



// 초기 실행 및 주기적 갱신
function initDashboard() {
    fetchPopulationData();
    fetchForecastData();
}

initDashboard();
setInterval(initDashboard, 10000); // 10초마다 갱신