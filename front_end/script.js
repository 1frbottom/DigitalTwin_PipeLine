// ---------------- misc funcs ----------------

// 혼잡도 태그 색/스타일
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

// ---------------- 실시간 인구 현황 ----------------

// 실시간 도시데이터 - 인구현황 (city_live_ppltn_proc)
async function fetchPopulationData() {
  try {
    const response = await fetch(
      "http://localhost:8000/city/population/current?area_name=강남역"
    );
    if (!response.ok) throw new Error("Current API Error");
    const data = await response.json();

    // (1) 혼잡도 태그 업데이트
    const congestEl = document.getElementById("pop-congest");
    const styleInfo = getColorByLevel(data.congest_lvl);

    congestEl.textContent = data.congest_lvl;
    congestEl.className = styleInfo.className;

    // 태그 배경색/글자색 커스텀
    if (data.congest_lvl.includes("여유") || data.congest_lvl.includes("보통")) {
      congestEl.style.backgroundColor = styleInfo.bg;
      congestEl.style.color = styleInfo.color;
    } else {
      congestEl.style.backgroundColor = "";
      congestEl.style.color = "";
    }

    // (2) 인구수 업데이트
    document
      .getElementById("pop-min")
      .textContent = data.ppltn_min.toLocaleString("ko-KR");
    document
      .getElementById("pop-max")
      .textContent = data.ppltn_max.toLocaleString("ko-KR");

    // (3) 기준 시간 업데이트
    const dbTime = new Date(data.ppltn_time);
    const timeString = dbTime.toLocaleString("ko-KR", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    document.getElementById("pop-time").textContent = `${timeString} 기준`;
  } catch (error) {
    console.error("인구 현황 수신 실패:", error);
  }
}

// ---------------- 예측 데이터 ----------------

// 실시간 도시데이터 : 인구현황 -> 예측 (city_live_ppltn_forecast)
async function fetchForecastData() {
  try {
    const response = await fetch(
      "http://localhost:8000/city/population/forecast?area_name=강남역"
    );

    const container = document.getElementById("forecast-chart");
    if (!container) {
      console.warn("HTML에 'forecast-chart' ID를 가진 요소가 없습니다.");
      return;
    }

    container.innerHTML = "";

    if (!response.ok) {
      container.innerHTML =
        "<span style='font-size:11px; color:#9ca3af; width:100%; text-align:center;'>예측 데이터 없음</span>";
      return;
    }

    const list = await response.json();

    if (!list || list.length === 0) {
      container.innerHTML =
        "<span style='font-size:11px; color:#9ca3af; width:100%; text-align:center;'>예측 데이터 준비중</span>";
      return;
    }

    const next6 = list.slice(0, 6);

    const values = next6.map((d) => d.fcst_max);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    next6.forEach((item) => {
      const fTime = new Date(item.fcst_time);
      const hourLabel = fTime.getHours() + "시";
      const styleInfo = getColorByLevel(item.fcst_congest_lvl);

      let heightPercent = 100;
      if (range > 0) {
        const ratio = (item.fcst_max - minVal) / range;
        heightPercent = 20 + ratio * 80;
      }

      const barHtml = `
        <div class="forecast-item">
          <div 
            class="bar-graph"
            title="${item.fcst_congest_lvl} (${item.fcst_min.toLocaleString()}~${item.fcst_max.toLocaleString()}명)" 
            style="height: ${heightPercent}%; background-color: ${styleInfo.color};"
          ></div>
          <div class="time-label">${hourLabel}</div>
        </div>
      `;
      container.insertAdjacentHTML("beforeend", barHtml);
    });
  } catch (error) {
    console.error("예측 데이터 수신 실패:", error);
  }
}

// ---------------- 대시보드 초기화 ----------------

function initDashboard() {
  fetchPopulationData();
  fetchForecastData();
}

initDashboard();
setInterval(initDashboard, 10000); // 10초마다 갱신

// ---------------- Google Map + CCTV 마커 ----------------

// CCTV 위치 목록 (예시 좌표)
const CCTV_LOCATIONS = [
  { id: 1, name: "강남역 10번 출구", lat: 37.498006, lng: 127.02762 },
  { id: 2, name: "강남역 11번 출구", lat: 37.49772, lng: 127.02845 },
  { id: 3, name: "강남대로 횡단보도 앞", lat: 37.4985, lng: 127.0268 },
];

let map;

function initMap() {
  const gangnam = { lat: 37.4979, lng: 127.0276 };

  map = new google.maps.Map(document.getElementById("google-map"), {
    center: gangnam,
    zoom: 16,
    disableDefaultUI: true,
  });


  // CCTV 마커 추가
  addCctvMarkers();
}

function addCctvMarkers() {
  const infoWindow = new google.maps.InfoWindow();

  CCTV_LOCATIONS.forEach((cctv) => {
    const marker = new google.maps.Marker({
      position: { lat: cctv.lat, lng: cctv.lng },
      map,
      title: cctv.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        // 대중교통 아이콘처럼 파스텔 동그라미
        scale: 10,                       // 크기
        fillColor: "#e0f2fe",            // 배경색 (버스 아이콘이랑 맞춤)
        fillOpacity: 1,
        strokeColor: "#2563eb",          // 테두리 색
        strokeWeight: 2,
      },
      // 가운데에 📹 이모지 라벨
      label: {
        text: "📹",
        fontSize: "14px",
      },
    });

    marker.addListener("click", () => {
      const html = `
        <div style="min-width: 160px;">
          <div style="font-weight:600; margin-bottom:4px;">${cctv.name}</div>
          <button 
            style="
              padding:4px 8px;
              font-size:11px;
              border-radius:999px;
              border:1px solid #3b82f6;
              background:#eff6ff;
              cursor:pointer;
            "
            onclick="openCctv('${cctv.id}')"
          >
            CCTV 보기
          </button>
        </div>
      `;
      infoWindow.setContent(html);
      infoWindow.open(map, marker);
    });
  });
}


// InfoWindow 안에서 쓰는 함수는 전역으로 노출
window.openCctv = function (cctvId) {
  console.log("CCTV 클릭:", cctvId);
  // TODO: 여기에 나중에 실제 스트리밍 모달/우측 패널 연동하면 됨
  // 예) window.location.href = `/cctv/${cctvId}`;
};
