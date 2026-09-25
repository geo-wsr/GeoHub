<template>
  <div class="skeleton-card card">
    <div class="skeleton skeleton--pill" />
    <div class="skeleton skeleton--title" />
    <div class="skeleton skeleton--line" />
    <div class="skeleton skeleton--line skeleton--short" />
    <div class="skeleton-body">
      <div class="skeleton skeleton--meta" />
      <div class="skeleton skeleton--meta" />
    </div>
  </div>
</template>

<style scoped>
.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 186px;
}

.skeleton--pill {
  width: 64px;
  height: 20px;
  border-radius: var(--radius-pill);
}

.skeleton--title {
  width: 78%;
  height: 20px;
}

.skeleton--line {
  width: 100%;
  height: 12px;
}

.skeleton--short {
  width: 62%;
}

.skeleton-body {
  display: flex;
  justify-content: space-between;
  margin-top: auto;
}

.skeleton--meta {
  width: 72px;
  height: 12px;
}
</style>
