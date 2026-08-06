-- ============================================================
-- 方向感 Supabase 数据库建表脚本（完整版，可重复执行）
-- 使用方法：Supabase → SQL Editor → 粘贴全部 → Run
-- ============================================================

-- ─── 清理（先删后建，确保干净）───
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS on_auth_user_created();
DROP POLICY IF EXISTS "own conversations" ON conversations;
DROP POLICY IF EXISTS "own messages" ON messages;
DROP POLICY IF EXISTS "own assessments" ON assessments;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS assessments;
DROP TABLE IF EXISTS conversations;

-- ─── 1. 会话表 ───
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  state JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- ─── 2. 消息表 ───
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  ui_message JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);

-- ─── 3. 测评历史表 ───
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_assessments_user ON assessments(user_id, created_at DESC);

-- ─── 4. RLS 策略 ───
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON messages
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM conversations WHERE id = conversation_id)
  );

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assessments" ON assessments
  FOR ALL USING (auth.uid() = user_id);

-- ─── 5. 注册触发器：新用户自动创建会话 ───
CREATE FUNCTION on_auth_user_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO conversations (user_id, state)
  VALUES (NEW.id, '{"step":1,"skills":[],"pendingSkills":[]}'::jsonb);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION on_auth_user_created();
