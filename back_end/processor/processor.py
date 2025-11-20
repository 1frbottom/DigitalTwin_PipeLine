from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, to_timestamp, explode
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType, ArrayType



spark = SparkSession.builder \
    .appName("TrafficDataProcessor") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.1,org.postgresql:postgresql:42.6.0") \
    .getOrCreate()

db_properties = {
    "url": "jdbc:postgresql://db:5432/traffic_db",
    "user": "user",
    "password": "password",
    "driver": "org.postgresql.Driver"
}

# --- 1. traffic_incidents 스트림 -----------------------------
incident_schema = StructType([
    StructField("acc_id", StringType(), False),
    StructField("occr_date", StringType(), True),
    StructField("occr_time", StringType(), True),
    StructField("exp_clr_date", StringType(), True),
    StructField("exp_clr_time", StringType(), True),
    StructField("acc_type", StringType(), True),
    StructField("acc_dtype", StringType(), True),
    StructField("link_id", StringType(), True),
    StructField("grs80tm_x", StringType(), True), 
    StructField("grs80tm_y", StringType(), True),
    StructField("acc_info", StringType(), True),
    StructField("timestamp", DoubleType(), True)
])

incident_stream_df = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:29092") \
    .option("subscribe", "traffic-incidents") \
    .option("startingOffsets", "earliest") \
    .load()

parsed_incident_df = incident_stream_df.select(from_json(col("value").cast("string"), incident_schema).alias("data")).select(
    col("data.acc_id").alias("acc_id"),
    col("data.occr_date").alias("occr_date"),
    col("data.occr_time").alias("occr_time"),
    col("data.exp_clr_date").alias("exp_clr_date"),
    col("data.exp_clr_time").alias("exp_clr_time"),
    col("data.acc_type").alias("acc_type"),
    col("data.acc_dtype").alias("acc_dtype"),
    col("data.link_id").alias("link_id"),
    col("data.grs80tm_x").cast(DoubleType()).alias("grs80tm_x"), 
    col("data.grs80tm_y").cast(DoubleType()).alias("grs80tm_y"),
    col("data.acc_info").alias("acc_info"),
    col("data.timestamp").alias("timestamp")
)

def write_incident_to_postgres(df, epoch_id):
    df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "traffic_incidents") \
      .mode("append") \
      .save()

query_incident = parsed_incident_df.writeStream \
    .foreachBatch(write_incident_to_postgres) \
    .start()

# --- 2. city_data_raw 스트림 ------------------------------
schema_city_data = StructType([
    StructField("area_nm", StringType(), False),
    StructField("area_cd", StringType(), False),
    StructField("timestamp", DoubleType(), True),
    StructField("live_ppltn_stts", StringType(), True),
    StructField("road_traffic_stts", StringType(), True),
    StructField("prk_stts", StringType(), True),
    StructField("sub_stts", StringType(), True),
    StructField("live_sub_ppltn", StringType(), True),
    StructField("bus_stn_stts", StringType(), True),
    StructField("live_bus_ppltn", StringType(), True),
    StructField("acdnt_cntrl_stts", StringType(), True),
    StructField("sbike_stts", StringType(), True),
    StructField("weather_stts", StringType(), True),
    StructField("charger_stts", StringType(), True),
    StructField("event_stts", StringType(), True),
    StructField("live_cmrcl_stts", StringType(), True),
    StructField("live_dst_message", StringType(), True),
    StructField("live_yna_news", StringType(), True)
])

stream_df_city_data = spark.readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:29092") \
    .option("subscribe", "city-data") \
    .option("startingOffsets", "earliest") \
    .load()

parsed_stream_df_city_data = stream_df_city_data.select(from_json(col("value").cast("string"), schema_city_data).alias("data")).select("data.*")

def write_citydata_to_postgres(df, epoch_id):
    df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "city_data_raw") \
      .mode("append") \
      .save()

query_city_data = parsed_stream_df_city_data.writeStream \
    .foreachBatch(write_citydata_to_postgres) \
    .start()


# --- 2-1. city_data_raw의 live_ppltn_stts 스트림 --------

    # 2-1-1. FCST_PPLTN (N) 부분의 스키마
schema_fcst_item = StructType([
    StructField("FCST_TIME", StringType(), True),
    StructField("FCST_CONGEST_LVL", StringType(), True),
    StructField("FCST_PPLTN_MIN", StringType(), True), 
    StructField("FCST_PPLTN_MAX", StringType(), True)
])

    # 2-1-2. FCST_PPLTN 부모 객체의 스키마
schema_fcst_parent = StructType([
    StructField("FCST_PPLTN", ArrayType(schema_fcst_item), True)
])

    # 2-1-3. LIVE_PPLTN_STTS (1) 부분의 "내부" 스키마
schema_inner_ppltn = StructType([
    StructField("AREA_CONGEST_LVL", StringType(), True),
    StructField("AREA_CONGEST_MSG", StringType(), True),
    StructField("AREA_PPLTN_MIN", StringType(), True),
    StructField("AREA_PPLTN_MAX", StringType(), True),
    StructField("PPLTN_TIME", StringType(), True),
    StructField("FCST_YN", StringType(), True),
    StructField("FCST_PPLTN", schema_fcst_parent, True) 
])

    # 2-1-4. LIVE_PPLTN_STTS (1) 부분의 "외부" 스키마
schema_outer_ppltn = StructType([
    StructField("LIVE_PPLTN_STTS", schema_inner_ppltn, True)
])

    # 2-1-5. `city_data_raw` 스트림에서 `live_ppltn_stts`(JSON 문자열) 필드를 가져와 파싱합니다.
parsed_ppltn_df = parsed_stream_df_city_data \
    .filter(col("live_ppltn_stts").isNotNull()) \
    .select(
        col("area_nm"),
        col("timestamp").alias("ingest_timestamp"), # 원본 수집 시각
        # "외부" 스키마(schema_outer_ppltn)로 파싱합니다.
        from_json(col("live_ppltn_stts"), schema_outer_ppltn).alias("ppltn_data_outer")
    ) \
    .select(
        "area_nm",
        "ingest_timestamp",
        # 파싱된 객체에서 "내부" 데이터의 필드들만 꺼내서 펼칩니다.
        col("ppltn_data_outer.LIVE_PPLTN_STTS.*") 
    )

    # 2-1-6. (테이블 1) 1:1 현황 데이터 (city_live_ppltn_proc) 준비
    # PPLTN_TIME (문자열)을 PostgreSQL TIMESTAMP 타입으로 변환
proc_df = parsed_ppltn_df \
    .select(
        "area_nm",
        "ingest_timestamp",
        to_timestamp(col("PPLTN_TIME"), "yyyy-MM-dd HH:mm").alias("ppltn_time"),
        col("AREA_CONGEST_LVL").alias("congest_lvl"),
        col("AREA_CONGEST_MSG").alias("congest_msg"),
        col("AREA_PPLTN_MIN").cast(IntegerType()).alias("ppltn_min"),
        col("AREA_PPLTN_MAX").cast(IntegerType()).alias("ppltn_max"),
        col("FCST_YN").alias("fcst_yn")
    ) \
    .filter(col("ppltn_time").isNotNull()) # 이상값 제거 (기준 시간이 없는 데이터 제외)


    # 2-1-7. (테이블 2) 1:N 예측 데이터 (city_live_ppltn_forecast) 준비
    # `explode` 함수로 FCST_PPLTN 배열을 여러 개의 행으로 펼칩니다.
forecast_df = parsed_ppltn_df \
    .filter(col("FCST_YN") == 'Y') \
    .select(
        "area_nm",
        to_timestamp(col("PPLTN_TIME"), "yyyy-MM-dd HH:mm").alias("base_ppltn_time"),
        # 점(.)을 사용해 객체 내부의 배열에 접근한 뒤 explode
        explode(col("FCST_PPLTN.FCST_PPLTN")).alias("fcst_item")
    ) \
    .select(
        "area_nm",
        "base_ppltn_time",
        to_timestamp(col("fcst_item.FCST_TIME"), "yyyy-MM-dd HH:mm").alias("fcst_time"),
        col("fcst_item.FCST_CONGEST_LVL").alias("fcst_congest_lvl"),
        col("fcst_item.FCST_PPLTN_MIN").cast(IntegerType()).alias("fcst_min"),
        col("fcst_item.FCST_PPLTN_MAX").cast(IntegerType()).alias("fcst_max")
    ) \
    .filter(
        (col("fcst_time").isNotNull()) & \
        (col("fcst_min") >= 0) & \
        (col("fcst_min") <= col("fcst_max"))
    )


    # 2-1-8. 두 테이블에 대한 DB Write 함수 정의
def write_proc_to_postgres(df, epoch_id):
    df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "city_live_ppltn_proc") \
      .mode("append") \
      .save()

def write_forecast_to_postgres(df, epoch_id):
    
    if df.rdd.isEmpty():
        return
    
    df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "city_live_ppltn_forecast") \
      .mode("append") \
      .save()

    # 2-1-9. 두 개의 새로운 스트림 시작
query_ppltn_proc = proc_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_proc_to_postgres) \
    .start()

query_ppltn_forecast = forecast_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_forecast_to_postgres) \
    .start()

# --- 2-2. city_data(city_data_raw)의 road_traffic_stts (AVG_ROAD_DATA) 스트림 --------

    # 2-2-1. 스키마 정의
    # 가장 안쪽 데이터 (AVG_ROAD_DATA)
schema_avg_road_data = StructType([
    StructField("ROAD_MSG", StringType(), True),
    StructField("ROAD_TRAFFIC_IDX", StringType(), True),
    StructField("ROAD_TRAFFIC_SPD", StringType(), True),
    StructField("ROAD_TRAFFIC_TIME", StringType(), True)
])

schema_road_raw = StructType([
    StructField("AVG_ROAD_DATA", schema_avg_road_data, True)
])

    # 2-2-2. 파싱 및 데이터 추출
parsed_road_df = parsed_stream_df_city_data \
    .filter(col("road_traffic_stts").isNotNull()) \
    .select(
        col("area_nm"),
        col("timestamp").alias("ingest_timestamp"),
        from_json(col("road_traffic_stts"), schema_road_raw).alias("road_data_outer")
    ) \
    .select(
        "area_nm",
        "ingest_timestamp",
        col("road_data_outer.AVG_ROAD_DATA.*") 
    )

    # 2-2-3. 타입 변환 및 컬럼 매핑 (city_live_road_traffic_avg 테이블 구조에 맞춤)
road_proc_df = parsed_road_df \
    .select(
        col("area_nm"),
        col("ROAD_MSG").alias("road_msg"),
        col("ROAD_TRAFFIC_IDX").alias("road_traffic_idx"),
        col("ROAD_TRAFFIC_SPD").cast(IntegerType()).alias("road_traffic_spd"),
        to_timestamp(col("ROAD_TRAFFIC_TIME"), "yyyy-MM-dd HH:mm").alias("road_traffic_time"),
        col("ingest_timestamp")
    ) \
    .filter(col("road_traffic_time").isNotNull())

    # 2-2-4. DB 적재 함수 정의
def write_road_avg_to_postgres(df, epoch_id):
    if df.rdd.isEmpty():
        return
        
    df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "city_road_traffic_stts_avg") \
      .mode("append") \
      .save()

    # 2-2-5. 스트림 시작
query_road_avg = road_proc_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_road_avg_to_postgres) \
    .start()




# ----------------------------------------------------

spark.streams.awaitAnyTermination()