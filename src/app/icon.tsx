import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FF3B30, #FF2D55, #AF52DE)',
          borderRadius: '116px',
          boxShadow: '0 16px 32px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60%',
            height: '60%',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '40px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: '16%',
              height: '50%',
              backgroundColor: '#FF2D55',
              borderRadius: '20px',
              top: '-10%',
            }}
          />
          <div
            style={{
              fontSize: '180px',
              fontWeight: 'bold',
              color: '#FF2D55',
              fontFamily: 'sans-serif',
              letterSpacing: '-10px',
            }}
          >
            M
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
