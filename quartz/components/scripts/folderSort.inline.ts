document.addEventListener("nav", () => {
  const listings = document.querySelectorAll(".page-listing")

  for (const listing of listings) {
    const sortBtns = listing.querySelectorAll<HTMLButtonElement>(".sort-btn")
    const ul = listing.querySelector(".section-ul")
    if (!ul || sortBtns.length === 0) continue

    const saved = localStorage.getItem("folderSortOrder") ?? "newest"

    function applySort(order: string) {
      if (!ul) return
      const items = Array.from(ul.querySelectorAll<HTMLLIElement>(":scope > li.section-li"))
      if (order === "oldest") {
        items.reverse()
      }
      for (const item of items) {
        ul.appendChild(item)
      }
      sortBtns.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.sort === order)
      })
      localStorage.setItem("folderSortOrder", order)
    }

    for (const btn of sortBtns) {
      btn.addEventListener("click", () => {
        applySort(btn.dataset.sort ?? "newest")
      })
      window.addCleanup(() => btn.removeEventListener("click", () => {}))
    }

    // Apply saved state on load
    if (saved === "oldest") {
      applySort("oldest")
    }
  }
})
