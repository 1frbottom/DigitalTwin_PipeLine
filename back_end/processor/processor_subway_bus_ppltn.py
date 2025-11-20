from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, to_timestamp, explode, hour, to_date, expr
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType, ArrayType

# Spark Session 생성
spark = SparkSession.builder \
    .appName("TransportationPopulationProcessor") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.1,org.postgresql:postgresql:42.6.0") \
    .getOrCreate()

db_properties = {
    "url": "jdbc:postgresql://db:5432/traffic_db",
    "user": "user",
    "password": "password",
    "driver": "org.postgresql.Driver"
}

# --- city_data 스트림 읽기 ---
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
    .option("startingOffsets", "latest") \
    .load()

parsed_stream_df_city_data = stream_df_city_data.select(
    from_json(col("value").cast("string"), schema_city_data).alias("data")
).select("data.*")

# ========================================
# 1. 지하철 도착 정보 처리 (subway_arrival_proc)
# ========================================

# SUB_DETAIL 배열 내부의 개별 도착 정보 스키마
schema_sub_detail_item = StructType([
    StructField("SUB_ROUTE_NM", StringType(), True),
    StructField("SUB_LINE", StringType(), True),
    StructField("SUB_ARMG1", StringType(), True),
    StructField("SUB_ARMG2", StringType(), True),
])

schema_sub_detail_parent = StructType([
    StructField("SUB_DETAIL", ArrayType(schema_sub_detail_item), True)
])

schema_sub_station = StructType([
    StructField("SUB_STN_NM", StringType(), True),
    StructField("SUB_STN_LINE", StringType(), True),
    StructField("SUB_DETAIL", schema_sub_detail_parent, True)
])

schema_sub_stts_outer = StructType([
    StructField("SUB_STTS", ArrayType(schema_sub_station), True)
])

parsed_subway_df = parsed_stream_df_city_data \
    .filter(col("sub_stts").isNotNull()) \
    .select(
        col("area_nm"),
        col("timestamp").alias("ingest_timestamp"),
        from_json(col("sub_stts"), schema_sub_stts_outer).alias("subway_data_outer")
    ) \
    .select(
        "area_nm",
        "ingest_timestamp",
        explode(col("subway_data_outer.SUB_STTS")).alias("station")
    ) \
    .select(
        "area_nm",
        "ingest_timestamp",
        col("station.SUB_STN_NM").alias("station_nm"),
        col("station.SUB_STN_LINE").alias("line_num"),
        explode(col("station.SUB_DETAIL.SUB_DETAIL")).alias("detail")
    ) \
    .select(
        "area_nm",
        "station_nm",
        "line_num",
        col("detail.SUB_ROUTE_NM").alias("train_line_nm"),
        col("detail.SUB_ARMG1").alias("arrival_msg_1"),
        col("detail.SUB_ARMG2").alias("arrival_msg_2"),
        to_timestamp(col("ingest_timestamp")).alias("ingest_timestamp")
    )

subway_arrival_df = parsed_subway_df \
    .filter(
        (col("station_nm").isNotNull()) & \
        (col("line_num").isNotNull()) & \
        (col("train_line_nm").isNotNull())
    )

def write_subway_arrival_to_postgres(df, epoch_id):
    if df.rdd.isEmpty():
        return

    from pyspark.sql.window import Window
    from pyspark.sql.functions import row_number

    window_spec = Window.partitionBy("area_nm", "station_nm", "line_num", "train_line_nm").orderBy(col("ingest_timestamp").desc())
    dedup_df = df.withColumn("row_num", row_number().over(window_spec)) \
                 .filter(col("row_num") == 1) \
                 .drop("row_num")

    dedup_df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "subway_arrival_proc") \
      .mode("append") \
      .save()

query_subway_arrival = subway_arrival_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_subway_arrival_to_postgres) \
    .start()

# ========================================
# 2. 지하철 인구 누적 데이터 처리 (subway_ppltn_raw/proc)
# ========================================

schema_sub_ppltn = StructType([
    StructField("SUB_5WTHN_GTON_PPLTN_MIN", StringType(), True),
    StructField("SUB_5WTHN_GTON_PPLTN_MAX", StringType(), True),
    StructField("SUB_5WTHN_GTOFF_PPLTN_MIN", StringType(), True),
    StructField("SUB_5WTHN_GTOFF_PPLTN_MAX", StringType(), True),
    StructField("SUB_STN_CNT", StringType(), True),
    StructField("SUB_STN_TIME", StringType(), True)
])

parsed_sub_ppltn_df = parsed_stream_df_city_data \
    .filter(col("live_sub_ppltn").isNotNull()) \
    .select(
        col("area_nm"),
        col("timestamp").alias("ingest_timestamp"),
        from_json(col("live_sub_ppltn"), schema_sub_ppltn).alias("sub_ppltn_data")
    ) \
    .select(
        "area_nm",
        "ingest_timestamp",
        "sub_ppltn_data.*"
    )

subway_ppltn_raw_df = parsed_sub_ppltn_df \
    .select(
        "area_nm",
        to_timestamp(col("ingest_timestamp")).alias("data_time"),
        ((col("SUB_5WTHN_GTON_PPLTN_MIN").cast(IntegerType()) + col("SUB_5WTHN_GTON_PPLTN_MAX").cast(IntegerType())) / 2)
            .cast(IntegerType()).alias("gton_avg"),
        ((col("SUB_5WTHN_GTOFF_PPLTN_MIN").cast(IntegerType()) + col("SUB_5WTHN_GTOFF_PPLTN_MAX").cast(IntegerType())) / 2)
            .cast(IntegerType()).alias("gtoff_avg"),
        col("SUB_STN_CNT").cast(IntegerType()).alias("stn_cnt")
    ) \
    .filter(col("gton_avg").isNotNull())

def write_subway_ppltn_to_postgres(df, epoch_id):
    if df.rdd.isEmpty():
        return

    from pyspark.sql.window import Window
    from pyspark.sql.functions import row_number

    window_spec = Window.partitionBy("area_nm", "data_time").orderBy(col("data_time").desc())
    dedup_raw_df = df.withColumn("row_num", row_number().over(window_spec)) \
                     .filter(col("row_num") == 1) \
                     .drop("row_num")

    dedup_raw_df.write \
      .format("jdbc") \
      .options(**db_properties) \
      .option("dbtable", "subway_ppltn_raw") \
      .mode("append") \
      .save()

    # 집계는 PostgreSQL Trigger가 자동으로 처리합니다

query_subway_ppltn = subway_ppltn_raw_df.writeStream \
    .outputMode("append") \
    .foreachBatch(write_subway_ppltn_to_postgres) \
    .start()

# ========================================
# 모든 스트림 대기
# ========================================
spark.streams.awaitAnyTermination()
