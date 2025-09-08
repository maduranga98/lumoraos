import React from "react";
import { AlertCircle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import CancelButton from "./CancelButton";

const FailDialog = ({
  isOpen,
  onClose,
  title = "Error",
  message,
  buttonText = "Try Again",
  onRetry,
  showCancelButton = true,
}) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        {message && <p className="text-sm text-gray-500 mb-6">{message}</p>}
        <div
          className={`flex gap-3 ${!showCancelButton ? "justify-center" : ""}`}
        >
          {showCancelButton && (
            <CancelButton onClick={onClose} className="flex-1">
              Cancel
            </CancelButton>
          )}
          <Button
            variant="danger"
            onClick={handleRetry}
            className={showCancelButton ? "flex-1" : "w-full"}
          >
            {buttonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default FailDialog;
