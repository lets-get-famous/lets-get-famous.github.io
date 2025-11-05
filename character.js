const characters = [
    { name: "Daria", role: "The Game Designer", img: "https://placehold.co/180x180?text=Daria" },
    { name: "Raeann", role: "The Actress", img: "https://placehold.co/180x180?text=Raeann" },
    { name: "Tony", role: "The Fashion Designer", img: "https://placehold.co/180x180?text=Tony" },
    { name: "Rami", role: "The Skater", img: "https://placehold.co/180x180?text=Rami" },
    { name: "Paige", role: "The Writer", img: "https://placehold.co/180x180?text=Paige" }
    // Add the rest later
  ];
  
  const carousel = document.getElementById("characterCarousel");
  let currentIndex = 0;
  
  // Build character cards
  function renderCarousel() {
    carousel.innerHTML = "";
    characters.forEach((char, index) => {
      const card = document.createElement("div");
      card.classList.add("character-card");
      if (index === currentIndex) card.classList.add("active");
      card.innerHTML = `
        <img src="${char.img}" alt="${char.name}">
        <h3>${char.name}</h3>
        <p>${char.role}</p>
      `;
      carousel.appendChild(card);
    });
  
    const offset = currentIndex * -270; // width + margin
    carousel.style.transform = `translateX(${offset}px)`;
  }
  
  document.getElementById("prevBtn").addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + characters.length) % characters.length;
    renderCarousel();
  });
  
  document.getElementById("nextBtn").addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % characters.length;
    renderCarousel();
  });
  
  document.getElementById("joinBtn").addEventListener("click", () => {
    const name = document.getElementById("playerName").value;
    const selected = characters[currentIndex];
  
    if (!name) {
      alert("Please enter your name!");
      return;
    }
  
    localStorage.setItem("playerName", name);
    localStorage.setItem("character", selected.name);
  
    document.getElementById("status").innerText =
      `Welcome, ${name} as ${selected.name} (${selected.role})! Waiting for the game to start...`;
  });
  
  renderCarousel();
  