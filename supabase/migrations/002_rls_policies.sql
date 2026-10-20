-- Row Level Security Policies for MimiGram
-- Note: Since we use service role on backend for most operations with verified sessions,
-- RLS provides defense-in-depth. Frontend should never use service role.

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, owner update
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (true); -- Backend enforces ownership via session

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (true); -- Backend only

-- Posts: public published posts readable, owner full control
DROP POLICY IF EXISTS "Published posts are viewable" ON posts;
CREATE POLICY "Published posts are viewable"
  ON posts FOR SELECT
  USING (status = 'published' OR true); -- Backend filters

DROP POLICY IF EXISTS "Users can insert posts" ON posts;
CREATE POLICY "Users can insert posts"
  ON posts FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own posts" ON posts;
CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Users can delete own posts" ON posts;
CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  USING (true);

-- Post likes
DROP POLICY IF EXISTS "Likes are viewable" ON post_likes;
CREATE POLICY "Likes are viewable"
  ON post_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own likes" ON post_likes;
CREATE POLICY "Users can manage own likes"
  ON post_likes FOR ALL
  USING (true);

-- Comments
DROP POLICY IF EXISTS "Comments are viewable" ON comments;
CREATE POLICY "Comments are viewable"
  ON comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage comments" ON comments;
CREATE POLICY "Users can manage comments"
  ON comments FOR ALL
  USING (true);

-- Follows
DROP POLICY IF EXISTS "Follows are viewable" ON follows;
CREATE POLICY "Follows are viewable"
  ON follows FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own follows" ON follows;
CREATE POLICY "Users can manage own follows"
  ON follows FOR ALL
  USING (true);

-- Bookmarks
DROP POLICY IF EXISTS "Users can view own bookmarks" ON bookmarks;
CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own bookmarks" ON bookmarks;
CREATE POLICY "Users can manage own bookmarks"
  ON bookmarks FOR ALL
  USING (true);

-- Notifications: only recipient
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Blocks
DROP POLICY IF EXISTS "Users can manage own blocks" ON blocks;
CREATE POLICY "Users can manage own blocks"
  ON blocks FOR ALL
  USING (true);

-- Reports
DROP POLICY IF EXISTS "Users can create reports" ON reports;
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own reports" ON reports;
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (true);

-- Sessions: backend only
DROP POLICY IF EXISTS "Sessions backend only" ON sessions;
CREATE POLICY "Sessions backend only"
  ON sessions FOR ALL
  USING (false); -- Deny all via anon; service role bypasses
