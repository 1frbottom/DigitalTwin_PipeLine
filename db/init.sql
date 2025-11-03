CREATE TABLE IF NOT EXISTS traffic_data (
    link_id VARCHAR(50) NOT NULL,              
    avg_speed DOUBLE PRECISION,                
    travel_time INTEGER,                       
    timestamp DOUBLE PRECISION,                
    PRIMARY KEY (link_id, timestamp)
);