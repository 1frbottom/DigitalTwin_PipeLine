const API_BASE_URL = 'http://localhost:8000';

async function fetchAPI(endpoint, params = {}) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${API_BASE_URL}${endpoint}?${queryString}` : `${API_BASE_URL}${endpoint}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        return { status: response.status, data };
    } catch (error) {
        return { status: 'error', error: error.message };
    }
}

// 1. 최근 교통 데이터
async function getRecentTraffic() {
    const resultDiv = document.getElementById('recent-response');
    const statusDiv = document.getElementById('recent-status');
    
    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    statusDiv.innerHTML = '⏳ 로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';
    
    const minutes = document.getElementById('minutes').value || 10;
    const limit = document.getElementById('limit').value || 100;
    
    const result = await fetchAPI('/api/traffic/recent', { minutes, limit, skip: 0 });
    
    if (result.status === 200) {
        statusDiv.innerHTML = '✅ 성공';
        statusDiv.className = 'status success';
        resultDiv.innerHTML = `<span class="success">데이터 개수: ${result.data.length}</span>\n\n${JSON.stringify(result.data, null, 2)}`;
    } else {
        statusDiv.innerHTML = '❌ 실패';
        statusDiv.className = 'status error';
        resultDiv.innerHTML = `<span class="error">Error: ${result.error || result.data}</span>`;
    }
}

// 2. 특정 링크 데이터
async function getTrafficByLink() {
    const resultDiv = document.getElementById('link-response');
    const statusDiv = document.getElementById('link-status');
    const linkId = document.getElementById('linkId').value;
    
    if (!linkId) {
        alert('링크 ID를 입력하세요');
        return;
    }
    
    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    statusDiv.innerHTML = '⏳ 로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';
    
    const result = await fetchAPI(`/api/traffic/link/${linkId}`, { limit: 50 });
    
    if (result.status === 200) {
        statusDiv.innerHTML = '✅ 성공';
        statusDiv.className = 'status success';
        resultDiv.innerHTML = `<span class="success">데이터 개수: ${result.data.length}</span>\n\n${JSON.stringify(result.data, null, 2)}`;
    } else {
        statusDiv.innerHTML = '❌ 실패';
        statusDiv.className = 'status error';
        resultDiv.innerHTML = `<span class="error">Error: ${result.error || JSON.stringify(result.data)}</span>`;
    }
}

// 3. 통계 데이터
async function getTrafficStats() {
    const resultDiv = document.getElementById('stats-response');
    const tableDiv = document.getElementById('stats-table');
    const statusDiv = document.getElementById('stats-status');
    
    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    statusDiv.innerHTML = '⏳ 로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';
    
    const result = await fetchAPI('/api/traffic/stats');
    
    if (result.status === 200) {
        statusDiv.innerHTML = '✅ 성공';
        statusDiv.className = 'status success';
        resultDiv.innerHTML = `<span class="success">링크 개수: ${result.data.length}</span>\n\n${JSON.stringify(result.data, null, 2)}`;
        
        // 테이블로도 표시
        let tableHTML = '<table><tr><th>링크 ID</th><th>평균 속도</th><th>데이터 수</th></tr>';
        result.data.forEach(item => {
            tableHTML += `<tr><td>${item.link_id}</td><td>${item.avg_speed_mean.toFixed(2)} km/h</td><td>${item.count}</td></tr>`;
        });
        tableHTML += '</table>';
        tableDiv.innerHTML = tableHTML;
    } else {
        statusDiv.innerHTML = '❌ 실패';
        statusDiv.className = 'status error';
        resultDiv.innerHTML = `<span class="error">Error: ${result.error || JSON.stringify(result.data)}</span>`;
        tableDiv.innerHTML = '';
    }
}

// 4. 헬스 체크
async function getHealth() {
    const resultDiv = document.getElementById('health-response');
    const statusDiv = document.getElementById('health-status');
    
    resultDiv.innerHTML = '<span class="loading">로딩 중...</span>';
    statusDiv.innerHTML = '⏳ 로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';
    
    const result = await fetchAPI('/health');
    
    if (result.status === 200) {
        statusDiv.innerHTML = '✅ 서버 정상';
        statusDiv.className = 'status success';
        resultDiv.innerHTML = `<span class="success">${JSON.stringify(result.data, null, 2)}</span>`;
    } else {
        statusDiv.innerHTML = '❌ 서버 오류';
        statusDiv.className = 'status error';
        resultDiv.innerHTML = `<span class="error">Error: ${result.error}</span>`;
    }
}

// 5. CCTV 스트리밍
async function loadCCTVStreams() {
    const statusDiv = document.getElementById('cctv-status');
    
    statusDiv.innerHTML = '⏳ 로딩 중...';
    statusDiv.className = 'status loading';
    statusDiv.style.display = 'inline-block';
    
    const result = await fetchAPI('/api/cctv/streams');
    
    if (result.status === 200) {
        statusDiv.innerHTML = '✅ 성공';
        statusDiv.className = 'status success';
        
        result.data.forEach((stream, i) => {
            const video = document.getElementById(`cctv${i + 1}`);
            const name = document.getElementById(`cctv${i + 1}-name`);
            
            if (name) name.textContent = stream.name;
            
            if (video && Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(stream.stream_url);
                hls.attachMedia(video);
            }
        });
    } else {
        statusDiv.innerHTML = '❌ 실패';
        statusDiv.className = 'status error';
        console.error('Error:', result.error || result.data);
    }
}
