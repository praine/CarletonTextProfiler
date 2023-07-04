var mainMixin = {
  methods: {
    showLoadingModal() {
      Swal.fire({
        allowOutsideClick: false,
        didOpen: function() {
          Swal.showLoading();
        }
      });
    },
    hideLoadingModal() {
      Swal.close();
    }
  }
};