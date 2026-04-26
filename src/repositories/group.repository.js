const BaseRepository = require("./base.repository");
const { COLLECTIONS, CACHE_KEYS } = require("../utils/constants");
const { db, admin } = require("../config/firebase");

class GroupRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.GROUPS);
  }

  async findAvailableForUser(profile) {
    const all = await this.findMany({ limitCount: 200 });
    return all.filter((g) => {
      if (g.scope === "all") return true;
      if (g.scope === "state") return profile.state === g.targetState;
      if (g.scope === "city") return profile.state === g.targetState && profile.city === g.targetCity;
      if (g.scope === "area")
        return (
          profile.state === g.targetState &&
          profile.city === g.targetCity &&
          profile.area === g.targetArea
        );
      return false;
    });
  }

  async addMember(groupId, uid) {
    await db.collection(COLLECTIONS.GROUPS).doc(groupId).update({
      members: admin.firestore.FieldValue.arrayUnion(uid),
      memberCount: admin.firestore.FieldValue.increment(1),
    });
  }

  async removeMember(groupId, uid) {
    await db.collection(COLLECTIONS.GROUPS).doc(groupId).update({
      members: admin.firestore.FieldValue.arrayRemove(uid),
      memberCount: admin.firestore.FieldValue.increment(-1),
    });
  }

  // Sub-collection for posts
  postsCol(groupId) {
    return db.collection(`${COLLECTIONS.GROUPS}/${groupId}/${COLLECTIONS.GROUP_POSTS}`);
  }

  async getPosts(groupId, limit = 50) {
    const snap = await this.postsCol(groupId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async createPost(groupId, data) {
    const ref = await this.postsCol(groupId).add({ ...data, likes: [], createdAt: Date.now() });
    return { id: ref.id, ...data };
  }

  async toggleLike(groupId, postId, uid, liked) {
    await this.postsCol(groupId)
      .doc(postId)
      .update({
        likes: liked
          ? admin.firestore.FieldValue.arrayUnion(uid)
          : admin.firestore.FieldValue.arrayRemove(uid),
      });
  }

  async deletePost(groupId, postId) {
    await this.postsCol(groupId).doc(postId).delete();
  }
}

module.exports = new GroupRepository();