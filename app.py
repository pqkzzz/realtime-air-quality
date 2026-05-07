import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from streamlit_option_menu import option_menu


st.set_page_config(page_title="AQI Monitoring Dashboard", page_icon="🌍", layout="wide")

def local_css():
    st.markdown("""
        <style>
        
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        
        
        html, body, [class*="css"] {
            font-family: 'Inter', sans-serif !important;
        }

        
        
        [data-testid="stSidebar"] {
            background-color: #A6D8E3 !important; 
        }
        
        [data-testid="stSidebar"] * {
            color: #2D3748 !important; 
        }

        
        div[data-testid="stMetric"] {
            background-color: #ffffff;
            border-radius: 20px; 
            padding: 20px;
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05); 
            border: none;
        }
        
        
        .stApp {
            background-color: #F8FAFC;
        }
        
        
        h1, h2, h3 {
            color: #0F172A;
            font-weight: 700;
        }
        </style>
    """, unsafe_allow_html=True)

local_css()


# 2. LOAD DATA MẪU 

@st.cache_data
def load_data():
    try:
        df = pd.read_csv("aqi_vietnam_april2026.csv")

        df = df.rename(columns={
            "province": "Thành phố",
            "datetime": "Thời gian",
            "pm2_5": "PM2.5",
            "pm10": "PM10",
            "carbon_monoxide": "CO",
            "nitrogen_dioxide": "NO2",
            "sulphur_dioxide": "SO2",
            "ozone": "O3",
            "us_aqi": "AQI"
        })

        # Convert datetime
        df["Thời gian"] = pd.to_datetime(df["Thời gian"], errors="coerce")

        # Convert số
        cols = ["PM2.5", "PM10", "CO", "NO2", "SO2", "O3", "AQI"]
        for col in cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        df = df.dropna()

        return df

    except Exception as e:
        st.error(f"Lỗi load data: {e}")
        return pd.DataFrame()

df = load_data()


# 3. CÁC HÀM RENDER TỪNG TAB

## Tab 1
def run_overview_page():
    st.title("TỔNG QUAN CHẤT LƯỢNG KHÔNG KHÍ TOÀN QUỐC")
    st.markdown("---")
    
    
    col_f1, col_f2, col_f3 = st.columns([1, 2, 1])

    with col_f1:
               
        options_list = ["Toàn quốc"] + sorted(df["Thành phố"].unique().tolist())

        
        selected_cities = st.multiselect(
            "Chọn các tỉnh/thành phố muốn xem:", 
            options=options_list,
            default=["Toàn quốc"], 
            key="tab1_multiselect"
        )

        if "Toàn quốc" in selected_cities:
         
            df_filtered = df.copy()
        elif len(selected_cities) == 0:
            st.warning("Vui lòng chọn ít nhất một tỉnh hoặc 'Toàn quốc' để hiển thị dữ liệu.")
            st.stop() 
        else:
            df_filtered = df[df["Thành phố"].isin(selected_cities)].copy()

    with col_f2:
        
        min_date = df["Thời gian"].min().date()
        max_date = df["Thời gian"].max().date()
        
        
        date_range = st.slider(
            "Khoảng thời gian :",
            min_value=min_date,
            max_value=max_date,
            value=(min_date, max_date),
            format="DD/MM/YYYY",
            key="tab1_date"
        )

    with col_f3:
        param = st.radio("Chỉ số:", ["AQI", "PM2.5", "PM10"], horizontal=True, key="tab1_param")

    
    df_filtered = df.copy()
    
        
    # Lọc theo Thời gian (Timeline)
    start_date, end_date = date_range
    mask = (df_filtered['Thời gian'].dt.date >= start_date) & (df_filtered['Thời gian'].dt.date <= end_date)
    df_filtered = df_filtered.loc[mask]
    
    # Khối KPI Scorecards
    st.markdown("### Chỉ số Hiệu suất")

    if not df_filtered.empty:
        avg = round(df_filtered[param].mean(), 2)

        max_row = df_filtered.loc[df_filtered[param].idxmax()]
        max_value = max_row[param]
        max_city = max_row["Thành phố"]

        risk = df_filtered[df_filtered["AQI"] > 150].shape[0]
        total = df_filtered.shape[0]

        who_gap = round(avg / 5, 2)  
        k1, k2, k3, k4 = st.columns(4)

        k1.metric("Nồng độ Trung bình", f"{avg}")
        k2.metric("Đỉnh Ô nhiễm", f"{max_value}", max_city)
        k3.metric("Mật độ Rủi ro", f"{risk}/{total}")
        k4.metric("WHO Gap", f"{who_gap} lần")
    else:
        st.warning("Không có dữ liệu cho khu vực hoặc khoảng thời gian này.")
        
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Biểu đồ
    col1, col2 = st.columns([6, 4])

    with col1:
        st.markdown("### Bản đồ Phân bổ Không gian")
        st.info("Dán code Bubble Map vào đây. ")
        map_placeholder = st.empty()

        st.markdown("### Biểu đồ Cột Xếp hạng")
        st.info("Dán code Bar Chart vào đây. ")
        bar_placeholder = st.empty()

    with col2:
        st.markdown("### Biểu đồ Vành khăn")
        st.info("Dán code Donut Chart vào đây. ")
        donut_placeholder = st.empty()

        st.markdown("### Insight")
        st.info("Viết text insight ")
## Tab 2
def run_trend_page():
    st.title("PHÂN TÍCH XU HƯỚNG VÀ THỐNG KÊ THEO KHU VỰC")
    st.markdown("---")
    
    # 1. Bố cục Bộ lọc
    col_f1, col_f2, col_f3 = st.columns([1, 1, 1])

    with col_f1:
        city = st.selectbox("Chọn tỉnh:", sorted(df["Thành phố"].unique()), key="trend_city")

    with col_f2:
        granularity = st.radio("Mức độ phân tích:", ["Theo Ngày (24h)", "Theo Tuần (7 ngày)"], horizontal=True, key="trend_granularity")

    with col_f3:
        min_date = df["Thời gian"].min().date()
        max_date = df["Thời gian"].max().date()
        selected_date = st.date_input(
            "Chọn mốc thời gian:", 
            value=min_date,
            min_value=min_date,
            max_value=max_date,
            key="trend_date"
        )

    
    df_city = df[df["Thành phố"] == city].copy()

    if granularity == "Theo Ngày (24h)":
        # Ép dải thời gian lấy chính xác 24h của ngày được chọn
        mask = df_city['Thời gian'].dt.date == selected_date
        df_filtered = df_city.loc[mask]
        
        
        df_group = df_filtered.copy() 
        
    else: 
    
        start_of_week = selected_date - pd.Timedelta(days=selected_date.weekday())
        end_of_week = start_of_week + pd.Timedelta(days=6)
        
        
        st.caption(f"*Đang hiển thị dữ liệu tuần: {start_of_week.strftime('%d/%m/%Y')} - {end_of_week.strftime('%d/%m/%Y')}*")
        
        mask = (df_city['Thời gian'].dt.date >= start_of_week) & (df_city['Thời gian'].dt.date <= end_of_week)
        df_filtered = df_city.loc[mask]
        
        df_group = df_filtered.resample("D", on="Thời gian").mean(numeric_only=True).reset_index()

    #Tính toán KPI dựa trên tập dữ liệu ĐÃ LỌC (24h hoặc 1 tuần)
    if not df_filtered.empty:
        avg = round(df_filtered["AQI"].mean(), 2)
        exceed = df_filtered[df_filtered["AQI"] > 100].shape[0]
        std = round(df_filtered["AQI"].std(), 2)
        max_val = df_filtered["AQI"].max()
        min_val = df_filtered["AQI"].min()

        k1, k2, k3, k4 = st.columns(4)
        k1.metric("Trung bình", avg)
        k2.metric("Số giờ rủi ro", exceed)
        k3.metric("Biến động (Std)", f"{std:.2f}" if pd.notna(std) else "0.00")
        k4.metric("Max/Min", f"{max_val}/{min_val}")
    else:
        st.warning(" Không có dữ liệu trong khoảng thời gian này.")
        df_group = pd.DataFrame()

    st.markdown("<br>", unsafe_allow_html=True)

    st.markdown("### Biểu đồ Chuỗi thời gian")
    st.info("Dán code Line Chart vào đây. ")
    line_placeholder = st.empty()

    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown("### Box Plot")
        st.info("Dán code Box Plot vào đây. ")
        box_placeholder = st.empty()

    with col2:
        st.markdown("### Calendar Heatmap")
        st.info("Dán code Heatmap vào đây.")
        heatmap_placeholder = st.empty()

    with col3:
        st.markdown("### Histogram")
        st.info("Dán code Histogram vào đây. ")
        hist_placeholder = st.empty()

## Tab 3
def run_correlation_page():
    st.title("PHÂN TÍCH TƯƠNG QUAN CÁC CHỈ SỐ")
    st.markdown("---")
    
    
    col_f1, col_f2, col_f3, col_f4 = st.columns(4)
    
    with col_f1:
        city_corr = st.selectbox("Tỉnh/Thành phố:", ["Toàn quốc"] + sorted(df["Thành phố"].unique()), key="corr_city")
        
    with col_f2:
        
        min_date = df["Thời gian"].min().date()
        max_date = df["Thời gian"].max().date()
        date_corr = st.date_input(
            "Khoảng thời gian:", 
            value=(min_date, max_date),
            min_value=min_date,
            max_value=max_date,
            key="corr_date"
        )

    with col_f3:
        x_var = st.selectbox("Biến X (Độc lập):", ["PM2.5", "PM10", "CO", "NO2", "SO2", "O3"], key="corr_x")
        
    with col_f4:
        y_var = st.selectbox("Biến Y (Phụ thuộc):", ["AQI"], key="corr_y")
        
    
    df_corr = df.copy()
    
    
    if city_corr != "Toàn quốc":
        df_corr = df_corr[df_corr["Thành phố"] == city_corr]
        
    if len(date_corr) == 2: 
        start_date, end_date = date_corr
        mask = (df_corr['Thời gian'].dt.date >= start_date) & (df_corr['Thời gian'].dt.date <= end_date)
        df_corr = df_corr.loc[mask]
        
    
    if len(df_corr) > 1 and df_corr[x_var].nunique() > 1 and df_corr[y_var].nunique() > 1:
        corr = df_corr[x_var].corr(df_corr[y_var])
    else:
        corr = 0.0 
        st.warning("Không đủ dữ liệu trong khoảng thời gian/khu vực này để tính tương quan.")
        
    
    st.metric(" Pearson r (Độ tương quan)", round(corr, 2))
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    col1, col2 = st.columns(2)

    with col1:
        st.markdown("### Scatter Plot")
        st.info("Dán code Scatter vào đây")
        scatter_placeholder = st.empty()

    with col2:
        st.markdown("### Radar Chart")
        st.info("Dán code Radar")
        radar_placeholder = st.empty()

# 4. SIDEBAR MENU 

with st.sidebar:
    
    st.markdown(
        """
        <div style="text-align: center; padding-bottom: 10px;">
            <img src="https://cdn-icons-png.flaticon.com/512/10051/10051415.png" width="90" style="margin-bottom: 15px; animation: float 3s ease-in-out infinite;">
            <h2 style='color: #2B6CB0; font-weight: 800; font-size: 24px; margin: 0;'>AQI Dashboard</h2>
        </div>
        
        <style>
        
        @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
            100% { transform: translateY(0px); }
        }
        </style>
        """, unsafe_allow_html=True
    )
    
    
    selected = option_menu(
        menu_title=None,
        options=["Tổng quan hiện trạng", "Xu hướng theo khu vực", "Tương quan các chỉ số"],
        icons=["house-door", "bar-chart-line", "diagram-3"], 
        menu_icon="cast",
        default_index=0,
        styles={
            "container": {
                "padding": "0!important", 
                "background-color": "transparent !important", 
                "background": "none",
                "border": "none"
            },
            "icon": {
                "color": "#2B6CB0", 
                "font-size": "20px"
            }, 
            "nav-link": {
                "font-family": "system-ui, -apple-system, Arial, sans-serif", 
                "font-size": "15px", 
                "text-align": "left", 
                "margin":"12px 0", 
                "padding": "12px 15px",
                "color": "#4A5568", 
                "border-radius": "15px", 
                "font-weight": "500",
                "transition": "all 0.3s ease-in-out"
            },
            "nav-link:hover": {
                "background-color": "rgba(255, 255, 255, 0.4)",
                "transform": "translateX(6px)"
            },
            "nav-link-selected": {
                "font-family": "system-ui, -apple-system, Arial, sans-serif", 
                "background-color": "#FFFFFF !important", 
                "color": "#2B6CB0 !important", 
                "font-weight": "700", 
                "box-shadow": "0 4px 12px rgba(0,0,0,0.08)",
                "transform": "scale(1.02)"
            },
        }
    )
    
    st.markdown("<br><hr style='border-top: 1px solid rgba(0,0,0,0.1); margin: 5px 0;'><br>", unsafe_allow_html=True)
    st.markdown("**Data Monitoring:**<br>Trực quan hóa chất lượng không khí Toàn quốc", unsafe_allow_html=True)

# 5. ROUTING

if selected == "Tổng quan hiện trạng":
    run_overview_page()
elif selected == "Xu hướng theo khu vực":
    run_trend_page()
elif selected == "Tương quan các chỉ số":
    run_correlation_page()