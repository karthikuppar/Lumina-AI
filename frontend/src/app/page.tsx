import ThreeDScene from '@/components/ThreeDScene';
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <ThreeDScene />
      <ChatInterface />
    </main>
  );
}
