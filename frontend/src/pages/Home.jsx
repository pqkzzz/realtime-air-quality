import { useAirQuality, useCreateAirQuality } from '../hooks/useAirQuality';

function Home() {
  const { data, loading, error } = useAirQuality();
  const { createData } = useCreateAirQuality();

  if (loading) return <p>Đang tải dữ liệu...</p>;
  if (error) return <p>Lỗi: {error}</p>;

  return (
    <div>
      <h1>Dữ Liệu Chất Lượng Không Khí</h1>
      
      {data.length === 0 ? (
        <p>Không có dữ liệu</p>
      ) : (
        <ul>
          {data.map((item) => (
            <li key={item.id}>{JSON.stringify(item)}</li>
          ))}
        </ul>
      )}

      <button onClick={() => createData({ aq_value: 50, city: 'Hà Nội' })}>
        Thêm Dữ Liệu Mới
      </button>
    </div>
  );
}

export default Home;