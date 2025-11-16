CREATE TABLE IF NOT EXISTS traffic_data (
    link_id VARCHAR(50) NOT NULL,
    avg_speed DOUBLE PRECISION,
    travel_time INTEGER,
    timestamp DOUBLE PRECISION,
    PRIMARY KEY (link_id, timestamp)
);

CREATE TABLE IF NOT EXISTS cctv_streams (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    stream_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CCTV 초기 데이터 삽입
INSERT INTO cctv_streams (id, name, stream_url) VALUES
    ('1', '강남역', 'https://strm2.spatic.go.kr/live/207.stream/chunklist_w1500799502.m3u8'),
    ('2', '강남대로', 'https://kakaocctv-cache.loomex.net/lowStream/_definst_/9999_low.stream/playlist.m3u8'),
    ('3', '신논현역', 'https://strm3.spatic.go.kr/live/289.stream/playlist.m3u8'),
    ('4', '논현역', 'https://strm2.spatic.go.kr/live/206.stream/playlist.m3u8')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS traffic_incidents (
    acc_id VARCHAR(50) NOT NULL,
    occr_date VARCHAR(8),
    occr_time VARCHAR(6),
    exp_clr_date VARCHAR(8),
    exp_clr_time VARCHAR(6),
    acc_type VARCHAR(10), 
    acc_dtype VARCHAR(10),
    link_id VARCHAR(50),
    grs80tm_x DOUBLE PRECISION,
    grs80tm_y DOUBLE PRECISION,
    acc_info TEXT,
    timestamp DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (acc_id, timestamp)
);