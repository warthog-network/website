

document.querySelector('.hamburger').addEventListener('click', () => {
  //document.querySelector('.nav-links').classList.toggle('expanded'); 
  document.querySelector('.mobileMenu').classList.toggle('show');
});
document.querySelector('.close-menu').addEventListener('click', () => {
  //document.querySelector('.nav-links').classList.toggle('expanded'); 
  document.querySelector('.mobileMenu').classList.toggle('hide');
});
