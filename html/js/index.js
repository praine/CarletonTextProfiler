var app = new Vue({
  el: '#app',
  data: {
    message: 'Hello Vue!'
  },
  created(){
    Dropzone.options.myDropzone = {
    // Configuration options go here
  };
  },
  methods:{
    
  }
})